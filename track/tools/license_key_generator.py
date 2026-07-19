#!/usr/bin/env python3
"""
Itinerary Tracker License Key SQL Generator

Small local helper for generating Supabase SQL commands for itinerary_license_keys.
It does not connect to Supabase and does not store secrets. It only creates random
license keys and SQL you can paste into the Supabase SQL Editor.

Run:
  python license_key_generator.py

Optional CLI example:
  python license_key_generator.py --prefix TOASTED --count 5 --max-redemptions 1 --events 25 --trips 25 --maps --memories --shopping --recaps
"""
from __future__ import annotations

import argparse
import secrets
import string
import sys
from dataclasses import dataclass

try:
    import tkinter as tk
    from tkinter import ttk, messagebox
except Exception:  # pragma: no cover
    tk = None
    ttk = None
    messagebox = None

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # avoids confusing I/O/0/1

@dataclass
class LicenseOptions:
    prefix: str = "TOASTED"
    count: int = 1
    max_redemptions: int = 1
    events_per_day: int = 25
    max_trips: int = 25
    maps: bool = True
    memories: bool = True
    shopping: bool = True
    recaps: bool = True


def clean_prefix(prefix: str) -> str:
    prefix = (prefix or "TOASTED").strip().upper().replace(" ", "-")
    safe = "".join(ch for ch in prefix if ch in string.ascii_uppercase + string.digits + "-")
    return safe.strip("-") or "TOASTED"


def generate_key(prefix: str = "TOASTED") -> str:
    prefix = clean_prefix(prefix)
    groups = ["".join(secrets.choice(ALPHABET) for _ in range(4)) for _ in range(3)]
    return f"{prefix}-{'-'.join(groups)}"


def sql_bool(value: bool) -> str:
    return "true" if value else "false"


def build_insert_sql(options: LicenseOptions) -> str:
    keys = [generate_key(options.prefix) for _ in range(max(1, options.count))]
    rows = []
    for key in keys:
        rows.append(
            f"('{key}', {int(options.max_redemptions)}, {int(options.events_per_day)}, {int(options.max_trips)}, "
            f"{sql_bool(options.maps)}, {sql_bool(options.memories)}, {sql_bool(options.shopping)}, {sql_bool(options.recaps)}, true)"
        )
    values = ",\n  ".join(rows)
    return f"""insert into public.itinerary_license_keys (
  license_key,
  max_redemptions,
  events_per_day,
  max_trips,
  enable_maps,
  enable_memories,
  enable_shopping_lists,
  enable_recaps,
  active
) values
  {values}
on conflict (license_key) do update set
  max_redemptions = excluded.max_redemptions,
  events_per_day = excluded.events_per_day,
  max_trips = excluded.max_trips,
  enable_maps = excluded.enable_maps,
  enable_memories = excluded.enable_memories,
  enable_shopping_lists = excluded.enable_shopping_lists,
  enable_recaps = excluded.enable_recaps,
  active = excluded.active;
"""


def build_grant_sql(email: str, options: LicenseOptions) -> str:
    email = (email or "").strip().replace("'", "''")
    if not email:
        return "-- Enter a user email first."
    return f"""select public.admin_set_itinerary_entitlements(
  p_email => '{email}',
  p_plan => 'premium',
  p_events_per_day => {int(options.events_per_day)},
  p_max_trips => {int(options.max_trips)},
  p_enable_maps => {sql_bool(options.maps)},
  p_enable_memories => {sql_bool(options.memories)},
  p_enable_shopping_lists => {sql_bool(options.shopping)},
  p_enable_recaps => {sql_bool(options.recaps)}
);
"""


def run_gui() -> int:
    if tk is None:
        return 1
    root = tk.Tk()
    root.title("Itinerary Tracker License Generator")
    root.geometry("900x680")

    main = ttk.Frame(root, padding=14)
    main.pack(fill="both", expand=True)

    vars_ = {
        "prefix": tk.StringVar(value="TOASTED"),
        "count": tk.IntVar(value=1),
        "max_redemptions": tk.IntVar(value=1),
        "events": tk.IntVar(value=25),
        "trips": tk.IntVar(value=25),
        "maps": tk.BooleanVar(value=True),
        "memories": tk.BooleanVar(value=True),
        "shopping": tk.BooleanVar(value=True),
        "recaps": tk.BooleanVar(value=True),
        "email": tk.StringVar(value=""),
    }

    grid = ttk.Frame(main)
    grid.pack(fill="x")

    def add_label_entry(row, label, var, width=18):
        ttk.Label(grid, text=label).grid(row=row, column=0, sticky="w", padx=(0, 8), pady=5)
        ent = ttk.Entry(grid, textvariable=var, width=width)
        ent.grid(row=row, column=1, sticky="ew", pady=5)
        return ent

    add_label_entry(0, "Key prefix", vars_["prefix"])
    add_label_entry(1, "Number of keys", vars_["count"])
    add_label_entry(2, "Max redemptions", vars_["max_redemptions"])
    add_label_entry(3, "Events per day", vars_["events"])
    add_label_entry(4, "Max trips", vars_["trips"])
    add_label_entry(5, "Grant existing user email", vars_["email"], width=34)

    checks = ttk.Frame(grid)
    checks.grid(row=0, column=2, rowspan=6, padx=24, sticky="nw")
    ttk.Label(checks, text="Feature unlocks").pack(anchor="w", pady=(0, 6))
    for key, text in [("maps", "Maps / routes"), ("memories", "Photo memories"), ("shopping", "Shopping lists"), ("recaps", "Trip recaps")]:
        ttk.Checkbutton(checks, text=text, variable=vars_[key]).pack(anchor="w", pady=3)

    text = tk.Text(main, wrap="none", height=24)
    text.pack(fill="both", expand=True, pady=(14, 8))

    def opts() -> LicenseOptions:
        return LicenseOptions(
            prefix=vars_["prefix"].get(),
            count=int(vars_["count"].get() or 1),
            max_redemptions=int(vars_["max_redemptions"].get() or 1),
            events_per_day=int(vars_["events"].get() or 25),
            max_trips=int(vars_["trips"].get() or 25),
            maps=bool(vars_["maps"].get()),
            memories=bool(vars_["memories"].get()),
            shopping=bool(vars_["shopping"].get()),
            recaps=bool(vars_["recaps"].get()),
        )

    def set_output(sql: str):
        text.delete("1.0", "end")
        text.insert("1.0", sql)

    def generate_keys():
        set_output(build_insert_sql(opts()))

    def generate_grant():
        set_output(build_grant_sql(vars_["email"].get(), opts()))

    def copy_sql():
        root.clipboard_clear()
        root.clipboard_append(text.get("1.0", "end-1c"))
        if messagebox:
            messagebox.showinfo("Copied", "SQL copied to clipboard.")

    buttons = ttk.Frame(main)
    buttons.pack(fill="x")
    ttk.Button(buttons, text="Generate license key SQL", command=generate_keys).pack(side="left", padx=(0, 8))
    ttk.Button(buttons, text="Generate direct user grant SQL", command=generate_grant).pack(side="left", padx=(0, 8))
    ttk.Button(buttons, text="Copy SQL", command=copy_sql).pack(side="left")

    generate_keys()
    root.mainloop()
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Itinerary Tracker license SQL.")
    parser.add_argument("--prefix", default="TOASTED")
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--max-redemptions", type=int, default=1)
    parser.add_argument("--events", type=int, default=25)
    parser.add_argument("--trips", type=int, default=25)
    parser.add_argument("--maps", action="store_true")
    parser.add_argument("--memories", action="store_true")
    parser.add_argument("--shopping", action="store_true")
    parser.add_argument("--recaps", action="store_true")
    parser.add_argument("--email", default="", help="Generate a direct entitlement grant for this email instead of key SQL.")
    parser.add_argument("--no-gui", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    ns = parse_args(argv or sys.argv[1:])
    feature_flags_given = ns.maps or ns.memories or ns.shopping or ns.recaps
    if not ns.no_gui and not argv and tk is not None:
        return run_gui()
    options = LicenseOptions(
        prefix=ns.prefix,
        count=ns.count,
        max_redemptions=ns.max_redemptions,
        events_per_day=ns.events,
        max_trips=ns.trips,
        maps=True if not feature_flags_given else ns.maps,
        memories=True if not feature_flags_given else ns.memories,
        shopping=True if not feature_flags_given else ns.shopping,
        recaps=True if not feature_flags_given else ns.recaps,
    )
    print(build_grant_sql(ns.email, options) if ns.email else build_insert_sql(options))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
