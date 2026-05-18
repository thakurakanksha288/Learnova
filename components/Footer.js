"use client";

import Link from "next/link";
import { BookOpen, Mail, Phone, MapPin, Twitter, Linkedin, Github, Youtube } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 border-t border-slate-800 text-slate-300">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="text-purple-500 w-6 h-6" />
              <span className="text-white text-xl font-bold">Learnova</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              AI-powered student engagement and smart attendance platform trusted by 10,000+ schools worldwide.
            </p>
            {/* Social Links */}
            <div className="flex gap-4 pt-2">
              <a href="https://twitter.com/learnova" target="_blank" rel="noopener noreferrer" rel="noopener noreferrer"
                className="text-slate-400 hover:text-purple-400 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="https://linkedin.com/company/learnova" target="_blank" rel="noopener noreferrer" rel="noopener noreferrer"
                className="text-slate-400 hover:text-purple-400 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="https://github.com/Premshaw23/Learnova" target="_blank" rel="noopener noreferrer" rel="noopener noreferrer"
                className="text-slate-400 hover:text-purple-400 transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="https://youtube.com/@learnova" target="_blank" rel="noopener noreferrer" rel="noopener noreferrer"
                className="text-slate-400 hover:text-purple-400 transition-colors">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              {[
                { label: "Home", href: "/" },
                { label: "About", href: "/about" },
                { label: "Activity", href: "/activity" },
                { label: "Contact", href: "/contact" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href}
                    className="text-slate-400 hover:text-purple-400 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* For Users */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Platform</h3>
            <ul className="space-y-2 text-sm">
              {[
                { label: "Student Dashboard", href: "/dashboard" },
                { label: "Teacher Dashboard", href: "/dashboard" },
                { label: "Admin Panel", href: "/dashboard" },
                { label: "Sign Up", href: "/auth" },
                { label: "Login", href: "/auth" },
              ].map((link) => (
                <li key={link.label}>
                  <Link href={link.href}
                    className="text-slate-400 hover:text-purple-400 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Contact Us</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2 text-slate-400">
                <Mail className="w-4 h-4 text-purple-500 shrink-0" />
                <span>support@learnova.com</span>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <Phone className="w-4 h-4 text-purple-500 shrink-0" />
                <span>+1 (800) 123-4567</span>
              </li>
              <li className="flex items-start gap-2 text-slate-400">
                <MapPin className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                <span>123 Education Lane, San Francisco, CA 94105</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>© {currentYear} Learnova. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-purple-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-purple-400 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}