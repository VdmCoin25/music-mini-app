import React from "react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/search", label: "Search", icon: "🔍" },
  { to: "/library", label: "Library", icon: "📚" },
  { to: "/upload", label: "Upload", icon: "⬆️" },
  { to: "/profile", label: "Profile", icon: "👤" },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) => `bottom-nav__item${isActive ? " active" : ""}`}
        >
          <span className="bottom-nav__icon">{item.icon}</span>
          <span className="bottom-nav__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
