"use client"

import { useState, useEffect } from "react"
import { Pill } from "lucide-react"

export function Navbar({ onStart }: { onStart?: () => void }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/90 backdrop-blur-md shadow-[0_1px_0_0_rgba(0,0,0,0.06)]"
          : "bg-transparent"
      }`}
    >
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center size-9 rounded-xl"
            style={{ background: "linear-gradient(135deg, #3d8f5f 0%, #2d7a50 100%)", boxShadow: "0 2px 8px rgba(61,143,95,0.3)" }}
          >
            <Pill className="size-4 text-white" />
          </div>
          <span
            className="text-[17px] font-bold tracking-tight"
            style={{ fontFamily: "var(--font-lora), Georgia, serif", color: "var(--foreground)" }}
          >
            MedLens
          </span>
        </div>

        {/* Nav links — subtle pill on hover */}
        <div className="hidden md:flex items-center gap-1">
          {[
            { label: "Features",     href: "#features"      },
            { label: "How It Works", href: "#how-it-works"  },
            { label: "Safety",       href: "#safety"        },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-black/5 transition-all duration-150"
            >
              {label}
            </a>
          ))}
        </div>

        {/* CTA — saturated sage pastel */}
        <button
          onClick={onStart}
          className="flex items-center h-9 px-5 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 hover:brightness-95 active:brightness-90 active:scale-[0.98]"
          style={{
            color: "#0f3320",
            background: "radial-gradient(ellipse at 50% 50%, #8fd4aa 0%, #6abf8e 100%)",
            boxShadow: "0 1px 3px rgba(40,120,70,0.25), 0 0 0 1px rgba(70,160,100,0.25)",
          }}
        >
          Start Consultation
        </button>

      </nav>
    </header>
  )
}