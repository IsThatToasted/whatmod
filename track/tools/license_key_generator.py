#!/usr/bin/env python3
"""
WeTrack License Admin

Local admin utility for generating WeTrack license SQL and, optionally, managing
live Supabase license keys / user entitlements.

Security model:
- Offline generation requires no Supabase credentials.
- Live Dashboard mode requires the project's Supabase URL and SERVICE ROLE key.
- Credentials are kept in memory only by default and are never embedded into WeTrack.
- You may provide WETRACK_SUPABASE_URL and WETRACK_SERVICE_ROLE_KEY environment variables.

Run on Windows:
  python license_key_generator.py
or use run_license_generator_windows.bat
"""
from __future__ import annotations

import argparse
import json
import os
import secrets
import string
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone

try:
    import tkinter as tk
    from tkinter import ttk, messagebox, simpledialog
except Exception:  # pragma: no cover
    tk = None
    ttk = None
    messagebox = None
    simpledialog = None

APP_TITLE = "WeTrack License Admin"
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


@dataclass
class LicenseOptions:
    prefix: str = "WETRACK"
    count: int = 1
    max_redemptions: int = 1
    events_per_day: int = 25
    max_trips: int = 25
    memory_limit_per_trip: int = 20
    maps: bool = True
    memories: bool = True
    shopping: bool = True
    recaps: bool = True
    expires_at: str = ""


def clean_prefix(prefix: str) -> str:
    prefix = (prefix or "WETRACK").strip().upper().replace(" ", "-")
    safe = "".join(ch for ch in prefix if ch in string.ascii_uppercase + string.digits + "-")
    return safe.strip("-") or "WETRACK"


def generate_key(prefix: str = "WETRACK") -> str:
    groups = ["".join(secrets.choice(ALPHABET) for _ in range(4)) for _ in range(3)]
    return f"{clean_prefix(prefix)}-{'-'.join(groups)}"


def sql_bool(value: bool) -> str:
    return "true" if value else "false"


def sql_text(value: str | None) -> str:
    if value is None or not str(value).strip():
        return "null"
    return "'" + str(value).strip().replace("'", "''") + "'"


def build_insert_sql(options: LicenseOptions) -> tuple[str, list[str]]:
    keys = [generate_key(options.prefix) for _ in range(max(1, options.count))]
    rows = []
    for key in keys:
        rows.append(
            "(" + ", ".join([
                sql_text(key), "2", str(int(options.max_redemptions)), str(int(options.events_per_day)),
                str(int(options.max_trips)), str(int(options.memory_limit_per_trip)),
                sql_bool(options.maps), sql_bool(options.memories), sql_bool(options.shopping),
                sql_bool(options.recaps), "true", sql_text(options.expires_at)
            ]) + ")"
        )
    values = ",\n  ".join(rows)
    sql = f"""insert into public.itinerary_license_keys (
  license_key,
  license_generation,
  max_redemptions,
  events_per_day,
  max_trips,
  memory_limit_per_trip,
  enable_maps,
  enable_memories,
  enable_shopping_lists,
  enable_recaps,
  active,
  expires_at
) values
  {values}
on conflict (license_key) do update set
  license_generation = excluded.license_generation,
  max_redemptions = excluded.max_redemptions,
  events_per_day = excluded.events_per_day,
  max_trips = excluded.max_trips,
  memory_limit_per_trip = excluded.memory_limit_per_trip,
  enable_maps = excluded.enable_maps,
  enable_memories = excluded.enable_memories,
  enable_shopping_lists = excluded.enable_shopping_lists,
  enable_recaps = excluded.enable_recaps,
  active = excluded.active,
  expires_at = excluded.expires_at;
"""
    return sql, keys


def build_grant_sql(email: str, options: LicenseOptions, active: bool = True, notes: str = "") -> str:
    email = (email or "").strip().replace("'", "''")
    if not email:
        return "-- Enter a user email first."
    return f"""select public.admin_set_itinerary_entitlement_by_email(
  p_email => '{email}',
  p_plan => 'premium',
  p_active => {sql_bool(active)},
  p_events_per_day => {int(options.events_per_day)},
  p_max_trips => {int(options.max_trips)},
  p_memory_limit_per_trip => {int(options.memory_limit_per_trip)},
  p_enable_maps => {sql_bool(options.maps)},
  p_enable_memories => {sql_bool(options.memories)},
  p_enable_shopping_lists => {sql_bool(options.shopping)},
  p_enable_recaps => {sql_bool(options.recaps)},
  p_admin_notes => {sql_text(notes)}
);
"""


class SupabaseAdminClient:
    def __init__(self, url: str, service_key: str):
        self.url = url.rstrip("/")
        self.key = service_key.strip()
        if not self.url.startswith("http") or not self.key:
            raise ValueError("Supabase URL and service role key are required")

    def _request(self, path: str, method: str = "GET", data=None, prefer: str | None = None):
        body = None if data is None else json.dumps(data).encode("utf-8")
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        req = urllib.request.Request(self.url + path, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw = resp.read().decode("utf-8")
                if not raw:
                    return None
                return json.loads(raw)
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            try:
                detail = json.loads(raw)
            except Exception:
                detail = raw
            raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Connection failed: {exc.reason}") from exc

    def list_license_keys(self):
        q = urllib.parse.urlencode({
            "select": "id,license_key,plan,license_generation,max_redemptions,redemption_count,active,expires_at,created_at,events_per_day,max_trips,memory_limit_per_trip,enable_maps,enable_memories,enable_shopping_lists,enable_recaps",
            "order": "created_at.desc",
        })
        return self._request("/rest/v1/itinerary_license_keys?" + q) or []

    def update_license(self, license_id: str, patch: dict):
        q = urllib.parse.urlencode({"id": f"eq.{license_id}"})
        return self._request("/rest/v1/itinerary_license_keys?" + q, "PATCH", patch, "return=representation")

    def create_license_rows(self, rows: list[dict]):
        return self._request("/rest/v1/itinerary_license_keys", "POST", rows, "return=representation")

    def list_auth_users(self):
        # GoTrue admin endpoint; fetch enough for a small/medium beta. Pagination can be added later.
        return (self._request("/auth/v1/admin/users?page=1&per_page=1000") or {}).get("users", [])

    def list_entitlements(self):
        q = urllib.parse.urlencode({
            "select": "user_id,plan,active,source,license_key,expires_at,created_at,updated_at,events_per_day,max_trips,memory_limit_per_trip,enable_maps,enable_memories,enable_shopping_lists,enable_recaps,admin_notes",
            "order": "updated_at.desc",
        })
        rows = self._request("/rest/v1/wetrack_user_entitlements?" + q) or []
        users = self.list_auth_users()
        email_map = {str(u.get("id")): (u.get("email") or "") for u in users}
        for row in rows:
            row["email"] = email_map.get(str(row.get("user_id")), "")
        return rows

    def update_entitlement(self, user_id: str, patch: dict):
        q = urllib.parse.urlencode({"user_id": f"eq.{user_id}"})
        return self._request("/rest/v1/wetrack_user_entitlements?" + q, "PATCH", patch, "return=representation")

    def update_entitlements_for_license(self, license_key: str, patch: dict):
        q = urllib.parse.urlencode({"license_key": f"eq.{license_key}", "source": "eq.license_key"})
        return self._request("/rest/v1/wetrack_user_entitlements?" + q, "PATCH", patch, "return=representation")

    def list_history(self):
        q = urllib.parse.urlencode({
            "select": "id,user_id,email_snapshot,event_type,source,license_key,created_at",
            "order": "created_at.desc",
            "limit": "500",
        })
        return self._request("/rest/v1/wetrack_license_history?" + q) or []


class AdminApp:
    def __init__(self, root):
        self.root = root
        self.root.title(APP_TITLE)
        self.root.geometry("1180x780")
        self.root.minsize(980, 680)
        self.client: SupabaseAdminClient | None = None
        self.license_rows: dict[str, dict] = {}
        self.entitlement_rows: dict[str, dict] = {}
        self._style()
        self._vars()
        self._build()

    def _style(self):
        s = ttk.Style(self.root)
        try:
            s.theme_use("clam")
        except Exception:
            pass
        self.root.configure(bg="#f7f5ff")
        s.configure("TFrame", background="#f7f5ff")
        s.configure("Card.TFrame", background="#ffffff", relief="solid", borderwidth=1)
        s.configure("TLabel", background="#f7f5ff", foreground="#111936", font=("Segoe UI", 10))
        s.configure("Title.TLabel", font=("Segoe UI Semibold", 19), foreground="#151a3b")
        s.configure("Muted.TLabel", foreground="#68708e")
        s.configure("TButton", font=("Segoe UI Semibold", 10), padding=(12, 8))
        s.configure("Accent.TButton", background="#7957ff", foreground="white")
        s.map("Accent.TButton", background=[("active", "#6845f2")])
        s.configure("Treeview", rowheight=30, font=("Segoe UI", 9), background="#ffffff", fieldbackground="#ffffff")
        s.configure("Treeview.Heading", font=("Segoe UI Semibold", 9))
        s.configure("TNotebook", background="#f7f5ff", borderwidth=0)
        s.configure("TNotebook.Tab", padding=(18, 10), font=("Segoe UI Semibold", 10))

    def _vars(self):
        self.vars = {
            "prefix": tk.StringVar(value="WETRACK"), "count": tk.IntVar(value=1),
            "max_redemptions": tk.IntVar(value=1), "events": tk.IntVar(value=25),
            "trips": tk.IntVar(value=25), "memory_limit": tk.IntVar(value=20),
            "maps": tk.BooleanVar(value=True), "memories": tk.BooleanVar(value=True),
            "shopping": tk.BooleanVar(value=True), "recaps": tk.BooleanVar(value=True),
            "expires": tk.StringVar(value=""), "email": tk.StringVar(value=""),
            "notes": tk.StringVar(value=""),
            "sb_url": tk.StringVar(value=os.getenv("WETRACK_SUPABASE_URL", "https://cuhbzgeqvgzshwwfkpdm.supabase.co")),
            "service_key": tk.StringVar(value=os.getenv("WETRACK_SERVICE_ROLE_KEY", "")),
            "status": tk.StringVar(value="Offline mode · Generate SQL without connecting to Supabase"),
        }

    def _build(self):
        shell = ttk.Frame(self.root, padding=18)
        shell.pack(fill="both", expand=True)
        header = ttk.Frame(shell)
        header.pack(fill="x", pady=(0, 12))
        ttk.Label(header, text="WeTrack License Admin", style="Title.TLabel").pack(side="left")
        ttk.Label(header, textvariable=self.vars["status"], style="Muted.TLabel").pack(side="right", padx=(12, 0))

        self.tabs = ttk.Notebook(shell)
        self.tabs.pack(fill="both", expand=True)
        self.tab_generate = ttk.Frame(self.tabs, padding=16)
        self.tab_licenses = ttk.Frame(self.tabs, padding=16)
        self.tab_users = ttk.Frame(self.tabs, padding=16)
        self.tab_history = ttk.Frame(self.tabs, padding=16)
        self.tab_connect = ttk.Frame(self.tabs, padding=16)
        self.tabs.add(self.tab_generate, text="Generate")
        self.tabs.add(self.tab_licenses, text="Live Licenses")
        self.tabs.add(self.tab_users, text="Users · Current")
        self.tabs.add(self.tab_history, text="History")
        self.tabs.add(self.tab_connect, text="Connection")
        self._build_generate()
        self._build_licenses()
        self._build_users()
        self._build_history()
        self._build_connection()

    def _options(self):
        return LicenseOptions(
            prefix=self.vars["prefix"].get(), count=max(1, int(self.vars["count"].get() or 1)),
            max_redemptions=max(1, int(self.vars["max_redemptions"].get() or 1)),
            events_per_day=max(1, int(self.vars["events"].get() or 25)), max_trips=max(1, int(self.vars["trips"].get() or 25)),
            memory_limit_per_trip=max(0, int(self.vars["memory_limit"].get() or 0)), maps=bool(self.vars["maps"].get()),
            memories=bool(self.vars["memories"].get()), shopping=bool(self.vars["shopping"].get()), recaps=bool(self.vars["recaps"].get()),
            expires_at=self.vars["expires"].get().strip(),
        )

    def _build_generate(self):
        left = ttk.Frame(self.tab_generate)
        left.pack(side="left", fill="y", padx=(0, 18))
        right = ttk.Frame(self.tab_generate)
        right.pack(side="left", fill="both", expand=True)
        ttk.Label(left, text="License limits", font=("Segoe UI Semibold", 13)).grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 10))
        fields = [
            ("Key prefix", "prefix"), ("Number of keys", "count"), ("Max redemptions", "max_redemptions"),
            ("Events / day", "events"), ("Max trips", "trips"), ("Memories / trip", "memory_limit"),
            ("Expires at (ISO, optional)", "expires"),
        ]
        for i, (label, key) in enumerate(fields, start=1):
            ttk.Label(left, text=label).grid(row=i, column=0, sticky="w", pady=5, padx=(0, 10))
            ttk.Entry(left, textvariable=self.vars[key], width=24).grid(row=i, column=1, sticky="ew", pady=5)
        r = len(fields) + 1
        ttk.Label(left, text="Feature access", font=("Segoe UI Semibold", 12)).grid(row=r, column=0, columnspan=2, sticky="w", pady=(14, 6))
        for n, (key, text) in enumerate([("maps", "Maps & routes"), ("memories", "Memories"), ("shopping", "Shopping lists"), ("recaps", "Trip recaps")], start=r+1):
            ttk.Checkbutton(left, text=text, variable=self.vars[key]).grid(row=n, column=0, columnspan=2, sticky="w", pady=3)

        ttk.Label(right, text="Generated SQL", font=("Segoe UI Semibold", 13)).pack(anchor="w")
        self.sql_text = tk.Text(right, wrap="none", font=("Cascadia Mono", 9), relief="flat", bg="#ffffff", fg="#1c2340", padx=12, pady=12)
        self.sql_text.pack(fill="both", expand=True, pady=(8, 10))
        buttons = ttk.Frame(right)
        buttons.pack(fill="x")
        ttk.Button(buttons, text="Generate key SQL", style="Accent.TButton", command=self.generate_sql).pack(side="left", padx=(0, 8))
        ttk.Button(buttons, text="Create live", command=self.create_live).pack(side="left", padx=(0, 8))
        ttk.Button(buttons, text="Copy", command=self.copy_sql).pack(side="left")
        self.generate_sql()

    def _build_licenses(self):
        toolbar = ttk.Frame(self.tab_licenses)
        toolbar.pack(fill="x", pady=(0, 10))
        ttk.Label(toolbar, text="Issued license keys", font=("Segoe UI Semibold", 13)).pack(side="left")
        ttk.Button(toolbar, text="Refresh", command=self.refresh_licenses).pack(side="right")
        ttk.Button(toolbar, text="Edit selected", command=self.edit_license).pack(side="right", padx=8)
        ttk.Button(toolbar, text="Revoke / restore", command=self.toggle_license).pack(side="right")
        cols = ("key", "active", "uses", "events", "trips", "memories", "features", "expires")
        self.license_tree = ttk.Treeview(self.tab_licenses, columns=cols, show="headings", selectmode="browse")
        headings = {"key":"License key", "active":"Status", "uses":"Redemptions", "events":"Events/day", "trips":"Trips", "memories":"Memories/trip", "features":"Features", "expires":"Expires"}
        widths = {"key":230,"active":80,"uses":95,"events":90,"trips":70,"memories":105,"features":220,"expires":150}
        for c in cols:
            self.license_tree.heading(c, text=headings[c]); self.license_tree.column(c, width=widths[c], anchor="w")
        self.license_tree.pack(fill="both", expand=True)

    def _build_users(self):
        toolbar = ttk.Frame(self.tab_users)
        toolbar.pack(fill="x", pady=(0, 10))
        ttk.Label(toolbar, text="Current user access · one authoritative row per account", font=("Segoe UI Semibold", 13)).pack(side="left")
        ttk.Button(toolbar, text="Refresh", command=self.refresh_users).pack(side="right")
        ttk.Button(toolbar, text="Edit selected", command=self.edit_user).pack(side="right", padx=8)
        ttk.Button(toolbar, text="Revoke / restore", command=self.toggle_user).pack(side="right")
        cols = ("email","plan","active","source","events","trips","memories","features","expires")
        self.user_tree = ttk.Treeview(self.tab_users, columns=cols, show="headings", selectmode="browse")
        labels = {"email":"Email","plan":"Plan","active":"Status","source":"Source","events":"Events/day","trips":"Trips","memories":"Memories/trip","features":"Features","expires":"Expires"}
        widths = {"email":210,"plan":75,"active":75,"source":90,"events":90,"trips":70,"memories":105,"features":220,"expires":145}
        for c in cols:
            self.user_tree.heading(c,text=labels[c]); self.user_tree.column(c,width=widths[c],anchor="w")
        self.user_tree.pack(fill="both", expand=True)

    def _build_history(self):
        toolbar = ttk.Frame(self.tab_history)
        toolbar.pack(fill="x", pady=(0, 10))
        ttk.Label(toolbar, text="License & entitlement history", font=("Segoe UI Semibold", 13)).pack(side="left")
        ttk.Button(toolbar, text="Refresh", command=self.refresh_history).pack(side="right")
        cols = ("when","email","event","source","key")
        self.history_tree = ttk.Treeview(self.tab_history, columns=cols, show="headings")
        labels={"when":"When","email":"Email","event":"Event","source":"Source","key":"License key"}
        widths={"when":165,"email":260,"event":150,"source":100,"key":300}
        for c in cols:
            self.history_tree.heading(c,text=labels[c]); self.history_tree.column(c,width=widths[c],anchor="w")
        self.history_tree.pack(fill="both",expand=True)

    def _build_connection(self):
        box = ttk.Frame(self.tab_connect)
        box.pack(fill="x", anchor="n")
        ttk.Label(box, text="Supabase admin connection", font=("Segoe UI Semibold", 14)).grid(row=0,column=0,columnspan=2,sticky="w",pady=(0,8))
        ttk.Label(box, text="Used only by this local admin tool. Never put a service role key in the web app.", style="Muted.TLabel").grid(row=1,column=0,columnspan=2,sticky="w",pady=(0,18))
        ttk.Label(box,text="Project URL").grid(row=2,column=0,sticky="w",pady=6,padx=(0,12))
        ttk.Entry(box,textvariable=self.vars["sb_url"],width=65).grid(row=2,column=1,sticky="ew",pady=6)
        ttk.Label(box,text="Service role key").grid(row=3,column=0,sticky="w",pady=6,padx=(0,12))
        ttk.Entry(box,textvariable=self.vars["service_key"],show="•",width=65).grid(row=3,column=1,sticky="ew",pady=6)
        ttk.Button(box,text="Connect",style="Accent.TButton",command=self.connect).grid(row=4,column=1,sticky="w",pady=(14,0))
        ttk.Label(box,text="Tip: set WETRACK_SUPABASE_URL and WETRACK_SERVICE_ROLE_KEY environment variables if you do not want to paste them every launch.",style="Muted.TLabel",wraplength=720).grid(row=5,column=0,columnspan=2,sticky="w",pady=(18,0))

    def set_output(self, sql):
        self.sql_text.delete("1.0", "end"); self.sql_text.insert("1.0", sql)

    def generate_sql(self):
        sql, _ = build_insert_sql(self._options()); self.set_output(sql)

    def copy_sql(self):
        self.root.clipboard_clear(); self.root.clipboard_append(self.sql_text.get("1.0", "end-1c")); self.toast("SQL copied")

    def toast(self, text):
        self.vars["status"].set(text)

    def connect(self):
        try:
            c = SupabaseAdminClient(self.vars["sb_url"].get(), self.vars["service_key"].get())
        except Exception as exc:
            messagebox.showerror("Connection", str(exc)); return
        self.vars["status"].set("Testing Supabase connection…")
        def work():
            try:
                c.list_license_keys(); self.client = c
                self.root.after(0, lambda: self._connected())
            except Exception as exc:
                self.root.after(0, lambda: messagebox.showerror("Supabase connection failed", str(exc)))
                self.root.after(0, lambda: self.vars["status"].set("Connection failed"))
        threading.Thread(target=work, daemon=True).start()

    def _connected(self):
        self.vars["status"].set("Connected to Supabase · live admin enabled")
        self.refresh_licenses(); self.refresh_users(); self.refresh_history()

    def require_client(self):
        if not self.client:
            messagebox.showinfo("Connect first", "Open the Connection tab and connect using the Supabase service role key.")
            return False
        return True

    def create_live(self):
        if not self.require_client(): return
        opts = self._options(); _, keys = build_insert_sql(opts)
        rows = [{
            "license_key":k,"license_generation":2,"plan":"premium","max_redemptions":opts.max_redemptions,"redemption_count":0,"active":True,
            "events_per_day":opts.events_per_day,"max_trips":opts.max_trips,"memory_limit_per_trip":opts.memory_limit_per_trip,
            "enable_maps":opts.maps,"enable_memories":opts.memories,"enable_shopping_lists":opts.shopping,"enable_recaps":opts.recaps,
            "expires_at": opts.expires_at or None,
        } for k in keys]
        try:
            self.client.create_license_rows(rows); self.set_output("\n".join(keys)); self.toast(f"Created {len(keys)} live license key(s)"); self.refresh_licenses()
        except Exception as exc: messagebox.showerror("Create license", str(exc))

    @staticmethod
    def feature_text(row):
        names=[]
        if row.get("enable_maps"): names.append("Maps")
        if row.get("enable_memories"): names.append("Memories")
        if row.get("enable_shopping_lists"): names.append("Shopping")
        if row.get("enable_recaps"): names.append("Recaps")
        return ", ".join(names) or "None"

    def refresh_licenses(self):
        if not self.require_client(): return
        self.vars["status"].set("Loading licenses…")
        def work():
            try: rows=self.client.list_license_keys(); self.root.after(0, lambda:self._fill_licenses(rows))
            except Exception as exc: self.root.after(0, lambda:messagebox.showerror("Load licenses",str(exc)))
        threading.Thread(target=work,daemon=True).start()

    def _fill_licenses(self, rows):
        self.license_tree.delete(*self.license_tree.get_children()); self.license_rows={}
        for row in rows:
            iid=str(row["id"]); self.license_rows[iid]=row
            uses=f"{row.get('redemption_count',0)}/{row.get('max_redemptions',1)}"
            self.license_tree.insert("", "end", iid=iid, values=(row.get("license_key",""),"Active" if row.get("active") else "Revoked",uses,row.get("events_per_day") or 25,row.get("max_trips") or 25,row.get("memory_limit_per_trip") or 20,self.feature_text(row),row.get("expires_at") or "Never"))
        self.vars["status"].set(f"Loaded {len(rows)} license key(s)")

    def selected_license(self):
        sel=self.license_tree.selection(); return self.license_rows.get(sel[0]) if sel else None

    def toggle_license(self):
        row=self.selected_license()
        if not row: messagebox.showinfo("Select a license","Choose a license first."); return
        new_active = not bool(row.get("active"))
        action = "restore" if new_active else "revoke"
        cascade = messagebox.askyesno(
            f"{action.title()} license",
            f"{action.title()} this license key and {'reactivate' if new_active else 'revoke'} users who redeemed it?\n\n"
            "Choose No to change only whether the key can be redeemed in the future."
        )
        try:
            self.client.update_license(str(row["id"]), {"active": new_active})
            if cascade:
                self.client.update_entitlements_for_license(row.get("license_key",""), {"active": new_active})
            self.refresh_licenses(); self.refresh_users()
        except Exception as exc: messagebox.showerror("Update license",str(exc))

    def edit_license(self):
        row=self.selected_license()
        if not row: messagebox.showinfo("Select a license","Choose a license first."); return
        self._edit_limits_dialog("Edit license", row, lambda patch:self._save_license(row,patch))

    def _save_license(self,row,patch):
        try:
            self.client.update_license(str(row["id"]),patch)
            # License-key entitlements inherit their limits from the key. Keep already-redeemed
            # users synchronized when an administrator changes the key in this dashboard.
            entitlement_patch = {k:v for k,v in patch.items() if k in {
                "events_per_day","max_trips","memory_limit_per_trip","enable_maps","enable_memories","enable_shopping_lists","enable_recaps"
            }}
            if entitlement_patch and row.get("license_key"):
                self.client.update_entitlements_for_license(row["license_key"], entitlement_patch)
            self.refresh_licenses(); self.refresh_users()
        except Exception as exc: messagebox.showerror("Update license",str(exc))

    def refresh_users(self):
        if not self.require_client(): return
        self.vars["status"].set("Loading entitlements…")
        def work():
            try: rows=self.client.list_entitlements(); self.root.after(0,lambda:self._fill_users(rows))
            except Exception as exc: self.root.after(0,lambda:messagebox.showerror("Load users",str(exc)))
        threading.Thread(target=work,daemon=True).start()

    def _fill_users(self, rows):
        self.user_tree.delete(*self.user_tree.get_children()); self.entitlement_rows={}
        for row in rows:
            iid=str(row["user_id"]); self.entitlement_rows[iid]=row
            self.user_tree.insert("","end",iid=iid,values=(row.get("email") or str(row.get("user_id")),row.get("plan",""),"Active" if row.get("active") else "Revoked",row.get("source",""),row.get("events_per_day") or 25,row.get("max_trips") or 25,row.get("memory_limit_per_trip") or 20,self.feature_text(row),row.get("expires_at") or "Never"))
        self.vars["status"].set(f"Loaded {len(rows)} user entitlement(s)")

    def refresh_history(self):
        if not self.require_client(): return
        def work():
            try: rows=self.client.list_history(); self.root.after(0,lambda:self._fill_history(rows))
            except Exception as exc: self.root.after(0,lambda:messagebox.showerror("Load history",str(exc)))
        threading.Thread(target=work,daemon=True).start()

    def _fill_history(self, rows):
        if not hasattr(self,"history_tree"): return
        self.history_tree.delete(*self.history_tree.get_children())
        for row in rows:
            self.history_tree.insert("","end",values=(
                row.get("created_at") or "",
                row.get("email_snapshot") or str(row.get("user_id") or ""),
                row.get("event_type") or "",
                row.get("source") or "",
                row.get("license_key") or ""
            ))

    def selected_user(self):
        sel=self.user_tree.selection(); return self.entitlement_rows.get(sel[0]) if sel else None

    def toggle_user(self):
        row=self.selected_user()
        if not row: messagebox.showinfo("Select a user","Choose an entitlement first."); return
        try: self.client.update_entitlement(str(row["user_id"]),{"active":not bool(row.get("active"))}); self.refresh_users()
        except Exception as exc: messagebox.showerror("Update entitlement",str(exc))

    def edit_user(self):
        row=self.selected_user()
        if not row: messagebox.showinfo("Select a user","Choose an entitlement first."); return
        self._edit_limits_dialog("Edit user entitlement",row,lambda patch:self._save_user(row,patch))

    def _save_user(self,row,patch):
        try: self.client.update_entitlement(str(row["user_id"]),patch); self.refresh_users()
        except Exception as exc: messagebox.showerror("Update entitlement",str(exc))

    def _edit_limits_dialog(self,title,row,on_save):
        win=tk.Toplevel(self.root); win.title(title); win.transient(self.root); win.grab_set(); win.geometry("430x480"); win.configure(bg="#f7f5ff")
        frame=ttk.Frame(win,padding=18); frame.pack(fill="both",expand=True)
        vals={
            "events_per_day":tk.IntVar(value=int(row.get("events_per_day") or 25)),
            "max_trips":tk.IntVar(value=int(row.get("max_trips") or 25)),
            "memory_limit_per_trip":tk.IntVar(value=int(row.get("memory_limit_per_trip") or 20)),
            "enable_maps":tk.BooleanVar(value=bool(row.get("enable_maps",True))),
            "enable_memories":tk.BooleanVar(value=bool(row.get("enable_memories",True))),
            "enable_shopping_lists":tk.BooleanVar(value=bool(row.get("enable_shopping_lists",True))),
            "enable_recaps":tk.BooleanVar(value=bool(row.get("enable_recaps",True))),
        }
        ttk.Label(frame,text=title,font=("Segoe UI Semibold",14)).pack(anchor="w",pady=(0,12))
        for label,key in [("Events / day","events_per_day"),("Max trips","max_trips"),("Memories / trip","memory_limit_per_trip")]:
            line=ttk.Frame(frame); line.pack(fill="x",pady=6); ttk.Label(line,text=label).pack(side="left"); ttk.Entry(line,textvariable=vals[key],width=10).pack(side="right")
        ttk.Separator(frame).pack(fill="x",pady=12)
        for key,text in [("enable_maps","Maps & routes"),("enable_memories","Memories"),("enable_shopping_lists","Shopping lists"),("enable_recaps","Trip recaps")]: ttk.Checkbutton(frame,text=text,variable=vals[key]).pack(anchor="w",pady=5)
        def save():
            patch={k:(int(v.get()) if k in ("events_per_day","max_trips","memory_limit_per_trip") else bool(v.get())) for k,v in vals.items()}; on_save(patch); win.destroy()
        ttk.Button(frame,text="Save changes",style="Accent.TButton",command=save).pack(side="bottom",fill="x",pady=(18,0))


def run_gui() -> int:
    if tk is None: return 1
    root=tk.Tk(); AdminApp(root); root.mainloop(); return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    p=argparse.ArgumentParser(description="Generate WeTrack license SQL.")
    p.add_argument("--prefix",default="WETRACK"); p.add_argument("--count",type=int,default=1); p.add_argument("--max-redemptions",type=int,default=1)
    p.add_argument("--events",type=int,default=25); p.add_argument("--trips",type=int,default=25); p.add_argument("--memory-limit",type=int,default=20)
    p.add_argument("--maps",action="store_true"); p.add_argument("--memories",action="store_true"); p.add_argument("--shopping",action="store_true"); p.add_argument("--recaps",action="store_true")
    p.add_argument("--email",default=""); p.add_argument("--no-gui",action="store_true")
    return p.parse_args(argv)


def main(argv: list[str] | None=None) -> int:
    ns=parse_args(argv or sys.argv[1:]); flags=ns.maps or ns.memories or ns.shopping or ns.recaps
    if not ns.no_gui and not argv and tk is not None: return run_gui()
    o=LicenseOptions(prefix=ns.prefix,count=ns.count,max_redemptions=ns.max_redemptions,events_per_day=ns.events,max_trips=ns.trips,memory_limit_per_trip=ns.memory_limit,
                     maps=True if not flags else ns.maps,memories=True if not flags else ns.memories,shopping=True if not flags else ns.shopping,recaps=True if not flags else ns.recaps)
    print(build_grant_sql(ns.email,o) if ns.email else build_insert_sql(o)[0]); return 0

if __name__ == "__main__": raise SystemExit(main())
