"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useState } from "react";
import { BookOpen, Mail, Phone, ArrowUpRight, Github, Twitter, Linkedin, Youtube, Heart, Sparkles, ExternalLink, Keyboard } from "lucide-react";
import { motion } from "framer-motion";
import { CONTACT_INFO } from "../constants/contact";

// Animated link component with underline hover effect
function FooterLink({ href, children, external = false }) {
  const LinkComponent = external ? "a" : Link;
  const externalProps = external
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <motion.li
      whileHover={{ x: 4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <LinkComponent
        href={href}
        {...externalProps}
        className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-300 hover:text-purple-400"
      >
        <span className="relative">
          {children}
          <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-to-r from-purple-400 to-blue-400 transition-all duration-300 group-hover:w-full" />
        </span>
        <ArrowUpRight
          size={12}
          className="opacity-0 -translate-y-0.5 translate-x-[-4px] transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0"
        />
      </LinkComponent>
    </motion.li>
  );
}

// Social icon button with glow hover
function SocialIcon({ href, icon: Icon, label, glowColor = "purple" }) {
  const glowMap = {
    purple: "hover:shadow-purple-500/30 hover:border-purple-500/50 hover:text-purple-400",
    blue: "hover:shadow-blue-500/30 hover:border-blue-500/50 hover:text-blue-400",
    pink: "hover:shadow-pink-500/30 hover:border-pink-500/50 hover:text-pink-400",
    red: "hover:shadow-red-500/30 hover:border-red-500/50 hover:text-red-400",
  };

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      whileHover={{ scale: 1.15, y: -3 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
      className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground backdrop-blur-sm transition-all duration-300 hover:shadow-lg ${glowMap[glowColor]}`}
    >
      <Icon size={18} />
    </motion.a>
  );
}

// Stagger animation wrapper
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};


export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [hoveredBrandLetter, setHoveredBrandLetter] = useState(null);

  const quickLinks = [
    { label: "Home", href: "/" },
    { label: "Productivity", href: "/productivity" },
    { label: "Activities", href: "/activity" },
    { label: "Contact", href: "/contact" },
    { label: "Register", href: "/register" },
    { label: "Contributors", href: "/contributors" },
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Streaks", href: "/streaks" },
  ];


  const sectionLinks = [
    { label: "Mission", href: "/#mission" },
    { label: "Values", href: "/#values" },
    { label: "Productivity", href: "/#productivity" },
    { label: "Team", href: "/#team" },
    { label: "Impact", href: "/#impact" },
    { label: "Get Started", href: "/#get-started" },
  ];

  const socialLinks = [
    { icon: Github, href: "https://github.com/Premshaw23/Learnova", label: "GitHub", glow: "purple" },
    { icon: Twitter, href: "https://twitter.com/learnova", label: "Twitter", glow: "blue" },
    { icon: Linkedin, href: "https://linkedin.com/company/learnova", label: "LinkedIn", glow: "blue" },
    { icon: Youtube, href: "https://youtube.com/@learnova", label: "YouTube", glow: "red" },
  ];

  const brandLetters = "LEARNOVA".split("");

  const contactLinks = [
    {
      label: CONTACT_INFO.email,
      href: `mailto:${CONTACT_INFO.email}`,
      icon: Mail,
    },
    {
      label: CONTACT_INFO.phone,
      href: `tel:${CONTACT_INFO.phone.replace(/\s+/g, "")}`,
      icon: Phone,
    },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-border/70 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.16),transparent_38%),linear-gradient(180deg,rgba(9,9,11,0.94),rgba(3,7,18,1))] text-foreground transition-colors duration-300">
      
      {/* ── Background decoration effects ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-6 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
        <svg
          className="absolute left-0 top-0 h-full w-full opacity-[0.08]"
          viewBox="0 0 1440 420"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path d="M0 240C160 180 320 180 480 220C640 260 800 340 960 320C1120 300 1280 180 1440 150V420H0V240Z" fill="url(#footerGlow)" />
          <defs>
            <linearGradient id="footerGlow" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A855F7" />
              <stop offset="0.5" stopColor="#22D3EE" />
              <stop offset="1" stopColor="#F472B6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-14 sm:py-16">
        <div className="grid gap-8 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl lg:grid-cols-[1.3fr_0.9fr_0.9fr_1fr] lg:p-8">
          
          {/* ── Brand Column ── */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/20 via-purple-500/20 to-cyan-500/20 ring-1 ring-white/10">
                <BookOpen className="h-5 w-5 text-fuchsia-200" />
              </span>
              <div>
                <p className="text-xl font-semibold tracking-tight text-white">Learnova</p>
                <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-200/80">
                  Smart Learning
                </p>
              </div>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-300">
              AI-powered engagement and smart attendance for modern campuses.
              Build consistent learning outcomes with real-time insights and a calmer, more connected workflow.
            </p>
            <div className="flex items-center gap-3 pt-2">
              {socialLinks.map((social) => (
                <SocialIcon
                  key={social.label}
                  href={social.href}
                  icon={social.icon}
                  label={social.label}
                  glowColor={social.glow}
                />
              ))}
            </div>
          </div>

          {/* ── Quick Links Column ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-white/90">
              Quick Links
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <FooterLink key={link.href} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
              <li>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("learnova:open-shortcuts"))}
                  className="group inline-flex items-center gap-2 text-left text-slate-300 transition-colors hover:text-white"
                >
                  <Keyboard className="h-4 w-4 text-fuchsia-200" />
                  <span>Keyboard Shortcuts</span>
                </button>
              </li>
            </ul>
          </div>

          {/* ── Sections Column ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-white/90">
              Sections
            </h3>
            <ul className="space-y-3">
              {sectionLinks.map((link) => (
                <FooterLink key={link.href} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
            </ul>
          </div>

          {/* ── Contact Column ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-white/90">
              Contact
            </h3>
            <ul className="space-y-3 text-sm">
              {contactLinks.map((link) => {
                const Icon = link.icon;

                return (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-slate-300 transition-all duration-200 hover:border-cyan-400/30 hover:bg-white/10 hover:text-white"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-cyan-200">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="break-all">{link.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-transparent to-cyan-500/10 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-fuchsia-200">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">Built for modern campuses</p>
                  <p className="text-xs leading-5 text-slate-300">
                    Track attendance, reduce admin load, and keep every stakeholder aligned.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} Learnova. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.24em] text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-fuchsia-200/90">
              Trusted by educators
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Built for modern classrooms
            </span>
          </div>
        </div>
      </div>

      {/* ── Large branding text ── */}
      <div className="relative overflow-hidden border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex items-center justify-center select-none" aria-hidden="true">
            {brandLetters.map((letter, i) => (
              <motion.span
                key={i}
                className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tight cursor-default"
                style={{
                  WebkitTextStroke: "1px",
                  WebkitTextStrokeColor:
                    hoveredBrandLetter === i
                      ? "rgba(168,85,247,0.5)"
                      : "rgba(255,255,255,0.06)",
                  color: "transparent",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={() => setHoveredBrandLetter(i)}
                onMouseLeave={() => setHoveredBrandLetter(null)}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  delay: i * 0.06,
                  duration: 0.5,
                  ease: "easeOut",
                }}
                whileHover={{
                  scale: 1.1,
                  color: "rgba(168,85,247,0.15)",
                  transition: { duration: 0.2 },
                }}
              >
                {letter}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}