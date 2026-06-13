import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import AttendanceBadge from "../AttendanceBadge";

vi.mock("framer-motion", async () => {
  const actualReact = await vi.importActual("react");

  // Helper to safely strip out motion-specific properties before rendering standard HTML tags
  const stripMotionProps = (props) => {
    const {
      whileHover,
      whileTap,
      animate,
      initial,
      exit,
      transition,
      variants,
      ...cleanProps
    } = props;
    return cleanProps;
  };

  return {
    motion: {
      article: actualReact.forwardRef(({ children, ...props }, ref) =>
        actualReact.createElement("article", { ref, ...stripMotionProps(props) }, children)
      ),
      div: actualReact.forwardRef(({ children, ...props }, ref) =>
        actualReact.createElement("div", { ref, ...stripMotionProps(props) }, children)
      ),
    },
  };
});

const defaultProps = {
  icon: "🏆",
  title: "Attendance Champion",
  description: "Maintain excellent attendance throughout the semester.",
  condition: "95% Attendance",
  progress: 87.8,
  unlocked: false,
};

describe("AttendanceBadge Achievement Display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders badge content correctly", () => {
    render(<AttendanceBadge {...defaultProps} />);

    expect(screen.getByText("🏆")).toBeInTheDocument();
    expect(screen.getByText("Attendance Champion")).toBeInTheDocument();
    expect(
      screen.getByText("Maintain excellent attendance throughout the semester.")
    ).toBeInTheDocument();
    expect(screen.getByText("95% Attendance")).toBeInTheDocument();
  });

  test("shows locked status when unlocked is false", () => {
    render(<AttendanceBadge {...defaultProps} unlocked={false} />);

    expect(screen.getByText("Locked")).toBeInTheDocument();
    expect(screen.queryByText("Unlocked")).not.toBeInTheDocument();
  });

  test("shows unlocked status when unlocked is true", () => {
    render(<AttendanceBadge {...defaultProps} unlocked={true} />);

    expect(screen.getByText("Unlocked")).toBeInTheDocument();
    expect(screen.queryByText("Locked")).not.toBeInTheDocument();
  });

  test("floors and displays progress percentage correctly", () => {
    render(<AttendanceBadge {...defaultProps} progress={87.8} />);

    expect(screen.getByText("87%")).toBeInTheDocument();
  });

  test("renders 100 percent progress correctly", () => {
    render(<AttendanceBadge {...defaultProps} progress={100} />);

    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  test("renders 0 percent progress correctly", () => {
    render(<AttendanceBadge {...defaultProps} progress={0} />);

    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});