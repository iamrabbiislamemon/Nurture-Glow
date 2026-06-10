import os

css_path = r"C:\Users\Administrator\Desktop\Nurture-Glow\Nurture-Glow\frontend\index.css"

with open(css_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Keep lines 1 to 289
trimmed_lines = lines[:289]

new_css = """/* ============================================================
   DARK MODE THEMING OVERRIDES — "Stealth Matte Black" Style
   ============================================================ */
html.dark,
.dark {
  color-scheme: dark;

  /* Map white and light gray to matte black tones */
  --color-white: #121212 !important;
  --color-gray-55: #0A0A0A !important;
  --color-gray-50: #0A0A0A !important;
  --color-gray-100: #18181C !important;
  --color-gray-200: #26262B !important;
  --color-gray-300: #3F3F46 !important;
  
  /* Slate and zinc fallbacks */
  --color-slate-50: #0A0A0A !important;
  --color-slate-100: #18181C !important;
  --color-slate-200: #26262B !important;
  --color-slate-300: #3F3F46 !important;

  --color-zinc-50: #0A0A0A !important;
  --color-zinc-100: #18181C !important;
  --color-zinc-200: #26262B !important;
  --color-zinc-300: #3F3F46 !important;
}

.dark body {
  background-color: #0A0A0A !important;
  color: #FFFFFF !important;
  font-family: var(--font-sans);
}

/* Escaped selectors for arbitrary light layouts */
.dark .bg-\\[\\#F7F5EF\\] {
  background-color: #0A0A0A !important;
}
.dark .bg-\\[\\#f8f6f1\\] {
  background-color: #0A0A0A !important;
}
.dark .bg-\\[\\#F7F5EF\\]\\/95 {
  background-color: rgba(10, 10, 10, 0.95) !important;
}

/* Sidebar Nav */
.dark aside {
  background-color: #121212 !important;
  border-right: 1px solid #26262B !important;
}
.dark aside .bg-gray-50 {
  background-color: #18181C !important;
}

/* Header */
.dark header {
  background-color: rgba(18, 18, 18, 0.85) !important;
  border-bottom: 1px solid #26262B !important;
}
.dark header .bg-gray-50 {
  background-color: #18181C !important;
}

/* Modals */
.dark .fixed .bg-white,
.dark [role="dialog"],
.dark .modal-content {
  background-color: #121212 !important;
  border: 1px solid #26262B !important;
}

/* Inputs, Textareas, Selects */
.dark input, 
.dark textarea, 
.dark select {
  background-color: #18181C !important;
  border-color: #26262B !important;
  color: #FFFFFF !important;
}
.dark input:focus, 
.dark textarea:focus, 
.dark select:focus {
  background-color: #1D1D22 !important;
  border-color: var(--color-primary-gold) !important;
}
.dark input::placeholder,
.dark textarea::placeholder {
  color: #71717A !important;
}

/* Map dark text colors to light text colors so they are readable on dark backgrounds */
.dark .text-gray-900,
.dark .text-gray-800,
.dark .text-gray-705,
.dark .text-gray-700,
.dark .text-[#1F1F1F],
.dark .text-slate-805,
.dark .text-slate-800,
.dark .text-slate-900 {
  color: #FFFFFF !important;
}
.dark .text-gray-650,
.dark .text-gray-605,
.dark .text-gray-600,
.dark .text-gray-500,
.dark .text-gray-400,
.dark .text-slate-500,
.dark .text-slate-600 {
  color: #A1A1AA !important;
}

/* Hover states */
.dark .hover\\:bg-gray-50:hover,
.dark .hover\\:bg-gray-100:hover {
  background-color: #18181C !important;
}
.dark .hover\\:text-gray-900:hover,
.dark .hover\\:text-gray-800:hover {
  color: #FFFFFF !important;
}

/* Borders */
.dark .border-gray-50,
.dark .border-gray-100,
.dark .border-gray-200,
.dark .border-gray-300,
.dark .border-[#E8E4DC] {
  border-color: #26262B !important;
}

/* Subtle Cards/Shadows */
.dark .shadow-sm,
.dark .shadow-md,
.dark .shadow-lg,
.dark .shadow-xl,
.dark .shadow-2xl {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
}

/* Auth Pages Specifics */
.dark .lg\\:w-\\[55\\%\\] {
  background-color: #121212 !important;
}
.dark .from-\\[\\#e8f5e9\\]\\/60 {
  --tw-gradient-from: rgba(27, 77, 62, 0.2) !important;
}
.dark .to-\\[\\#fff8e7\\]\\/50 {
  --tw-gradient-to: rgba(201, 169, 97, 0.15) !important;
}
.dark .lg\\:w-\\[55\\%\\] .bg-white\\/70 {
  background-color: rgba(18, 18, 18, 0.6) !important;
}
.dark .lg\\:w-\\[55\\%\\] .bg-white\\/50 {
  background-color: rgba(18, 18, 18, 0.4) !important;
}

/* Overwrite left panel bright gradient to dark matte black gradient */
.dark .lg\\:w-\\[55\\%\\] .bg-gradient-to-br {
  background-image: linear-gradient(to bottom right, rgba(27, 77, 62, 0.2), #0A0A0A, rgba(201, 169, 97, 0.15)) !important;
}

/* Landing Page Gradients Overrides */
.dark .min-h-screen.bg-gradient-to-b.from-yellow-50 {
  background-image: linear-gradient(to bottom, #0A0A0A, #121212, #0A0A0A) !important;
}
.dark section.bg-gradient-to-r.from-yellow-50 {
  background-image: linear-gradient(to right, #0A0A0A, #121212, #0A0A0A) !important;
}
.dark section.bg-gradient-to-b.from-amber-50 {
  background-image: linear-gradient(to bottom, #121212, #18181C, #0A0A0A) !important;
}

/* Feature cards soft gradients */
.dark .from-emerald-50 { --tw-gradient-from: rgba(27, 77, 62, 0.1) !important; }
.dark .to-green-50 { --tw-gradient-to: rgba(34, 197, 94, 0.02) !important; }
.dark .from-slate-50 { --tw-gradient-from: rgba(100, 116, 139, 0.1) !important; }
.dark .to-gray-50 { --tw-gradient-to: rgba(107, 114, 128, 0.02) !important; }
.dark .from-yellow-50 { --tw-gradient-from: rgba(201, 169, 97, 0.1) !important; }
.dark .to-amber-50 { --tw-gradient-to: rgba(245, 158, 11, 0.02) !important; }
.dark .from-amber-50 { --tw-gradient-from: rgba(245, 158, 11, 0.1) !important; }
.dark .to-yellow-50 { --tw-gradient-to: rgba(201, 169, 97, 0.02) !important; }
.dark .from-teal-50 { --tw-gradient-from: rgba(20, 184, 166, 0.1) !important; }
.dark .to-cyan-50 { --tw-gradient-to: rgba(6, 182, 212, 0.02) !important; }
.dark .from-green-50 { --tw-gradient-from: rgba(34, 197, 94, 0.1) !important; }
.dark .to-emerald-50 { --tw-gradient-to: rgba(27, 77, 62, 0.02) !important; }

.dark .from-emerald-50.via-yellow-25.to-slate-50 {
  background-image: linear-gradient(135deg, rgba(27, 77, 62, 0.15), rgba(201, 169, 97, 0.05), rgba(100, 116, 139, 0.05)) !important;
}

/* Fix top navbar on landing */
.dark nav {
  background-color: rgba(10, 10, 10, 0.92) !important;
  border-bottom: 1px solid rgba(38, 38, 43, 0.5) !important;
}
.dark nav .text-gray-55,
.dark nav .text-gray-500 {
  color: #A1A1AA !important;
}
.dark nav .hover\\:text-\\[\\#1F1F1F\\]:hover {
  color: #FFFFFF !important;
}
.dark nav .text-\\[\\#1F1F1F\\] {
  color: #FFFFFF !important;
}
.dark nav .bg-\\[\\#F7F5EF\\]\\/95 {
  background-color: rgba(10, 10, 10, 0.95) !important;
}
.dark nav .bg-\\[\\#F7F5EF\\] {
  background-color: #0A0A0A !important;
}

/* Fix specific widgets/components dashboard layout */
.dark .custom-scrollbar::-webkit-scrollbar-track {
  background: #121212 !important;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--color-primary-gold) !important;
}

/* Soft gold focus glow in dark mode */
.dark .focus-within\\:ring-emerald-500\\/20:focus-within {
  --tw-ring-color: rgba(201, 169, 97, 0.35) !important;
}

/* Dashboard Breadcrumb */
.dark .from-white\\/50.to-white\\/30 {
  background-image: linear-gradient(to right, rgba(18, 18, 18, 0.6), rgba(18, 18, 18, 0.4)) !important;
}

/* Patient profile & submenus */
.dark .hover\\:bg-emerald-50\\/50:hover {
  background-color: rgba(27, 77, 62, 0.12) !important;
}
.dark .hover\\:bg-amber-50\\/50:hover {
  background-color: rgba(201, 169, 97, 0.12) !important;
}
.dark .hover\\:bg-blue-50\\/50:hover {
  background-color: rgba(59, 130, 246, 0.12) !important;
}
.dark .hover\\:bg-purple-50\\/50:hover {
  background-color: rgba(139, 92, 246, 0.12) !important;
}
"""

with open(css_path, "w", encoding="utf-8") as f:
    f.writelines(trimmed_lines)
    f.write(new_css)

print("index.css updated successfully!")
