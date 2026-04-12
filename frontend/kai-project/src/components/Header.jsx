import React from "react";

export default function Header() {
  return (
    <header className="flex justify-between items-center px-8 py-4 border-b border-outline/30 sticky top-0 bg-background z-50">
      
      <div className="text-xl font-bold tracking-widest uppercase font-headline">
        KAI
      </div>

      <nav className="hidden md:flex gap-8">
        <a className="text-outlineSoft hover:text-white">Ranking</a>
        <a className="text-white border-b-2 border-white pb-1">Tendencias</a>
        <a className="text-outlineSoft hover:text-white">Artículos</a>
        <a className="text-outlineSoft hover:text-white">Instituciones</a>
      </nav>

      <div className="flex gap-4">
        <span className="material-symbols-outlined cursor-pointer">
          account_circle
        </span>
        <span className="material-symbols-outlined cursor-pointer">
          settings
        </span>
      </div>

    </header>
  );
}