import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { withErrorHandler } from "@/lib/error-handler";
import { checkRateLimit } from "@/lib/rateLimit";
import { del, put } from "@vercel/blob";
import {
  extractImageFileFromFormData,
  fetchAndValidateImage,
  getImageResponseHeaders,
  getUserImageFromDb,
  updateUserImageInDb,
  uploadAvatarToBlob,
} from "@/lib/images/imagesService";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  await requireAuth(request);

  const imageUrl = await getUserImageFromDb({ id });
  const { imageBuffer, contentType } = await fetchAndValidateImage(imageUrl);

  return new NextResponse(imageBuffer, {
    status: 200,
    headers: getImageResponseHeaders(contentType),
  });
});

export const POST = withErrorHandler(async (request) => {
  const decodedToken = await requireAuth(request);
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateLimitResult = await checkRateLimit(`images_post_${ip}_${decodedToken.uid}`);
  if (!rateLimitResult.allowed) {
    const { AppError } = require("@/lib/errors");
    throw new AppError("Too many attempts. Please try again later.", 429);
  }
  const formData = await request.formData();
  const file = extractImageFileFromFormData(formData);

  const { blobUrl } = await uploadAvatarToBlob({
    file,
    uid: decodedToken.uid,
  });

  await updateUserImageInDb({
    firebaseUid: decodedToken.uid,
    imageUrl: blobUrl,
  });
    const rawFaceDescriptor = formData.get("faceDescriptor");
    let faceDescriptor = null;
    if (rawFaceDescriptor) {
      if (typeof rawFaceDescriptor !== "string" || rawFaceDescriptor.length > 20000) {
        throw new ValidationError("Face descriptor payload too large");
      }
      try {
        const parsed = JSON.parse(rawFaceDescriptor);
        const faceDescriptorSchema = z.array(z.number()).length(128);
        faceDescriptor = faceDescriptorSchema.parse(parsed);
      } catch {
        throw new ValidationError("Invalid face descriptor format");
      }
    }

    if (!file || typeof file === "string" || !file.type) {
      throw new ValidationError("File is required and must be a valid file");
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError("File size exceeds 5MB limit");
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new ValidationError("Invalid image type");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Vercel Blob
    const fileExtension = file.type.split("/")[1] || "jpg";
    const fileName = `avatars/${decodedToken.uid}-${randomUUID()}.${fileExtension}`;
    const blob = await put(fileName, buffer, {
      contentType: file.type,
      access: "public",
    });

    // Update in MongoDB if exists
    const db = await connectDb();
    const users = db.collection("users");
    const updatePayload = { image: blob.url };
    if (faceDescriptor) {
      updatePayload.faceDescriptor = faceDescriptor;
    }
    try {
      await users.updateOne(
        { firebaseUid: decodedToken.uid },
        { $set: updatePayload }
      );
    } catch (error) {
      await del(blob.url).catch(() => {});
      throw error;
    }

  return NextResponse.json({ success: true, url: blobUrl });
});
