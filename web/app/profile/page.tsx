"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/Header";
import OtpInput from "@/components/OtpInput";
import { Alert, RequireAuth } from "@/components/ui";
import { api, errorMessage, uploadImage } from "@/lib/api";
import type { Me, OtpResponse } from "@/lib/types";

function Profile() {
  const { user, reloadUser } = useAuth();
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [avatar, setAvatar] = useState("");
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [pwMsg, setPwMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [contact, setContact] = useState("");
  const [contactSent, setContactSent] = useState<OtpResponse | null>(null);
  const [code, setCode] = useState("");
  const [contactMsg, setContactMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAbout(user.about);
      setAvatar(user.avatar_url);
    }
  }, [user]);
  if (!user) return null;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api<Me>("/me", { method: "PUT", body: { name, about, avatar_url: avatar, location_id: user.location_id } });
      await reloadUser();
      setMsg({ kind: "success", text: "Profile saved" });
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/me/password", { method: "PUT", body: pw });
      setPw({ current_password: "", new_password: "" });
      setPwMsg({ kind: "success", text: "Password changed" });
    } catch (err) {
      setPwMsg({ kind: "error", text: errorMessage(err) });
    }
  };

  const requestContact = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      setContactSent(await api<OtpResponse>("/me/contact/request", { method: "POST", body: { target: contact } }));
      setContactMsg(null);
    } catch (err) {
      setContactMsg({ kind: "error", text: errorMessage(err) });
    }
  };

  const verifyContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/me/contact/verify", { method: "POST", body: { target: contactSent!.target, code } });
      await reloadUser();
      setContactSent(null);
      setContact("");
      setCode("");
      setContactMsg({ kind: "success", text: "Contact verified and saved" });
    } catch (err) {
      setContactMsg({ kind: "error", text: errorMessage(err) });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Profile & settings</h1>

      <form onSubmit={saveProfile} className="card space-y-4 p-6">
        <div className="flex items-center gap-4">
          <Avatar name={name || "?"} url={avatar} size={72} />
          <label className="btn-outline cursor-pointer">
            Change photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setAvatar(await uploadImage(f, "avatars").catch(() => avatar));
              }}
            />
          </label>
        </div>
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </div>
        <div>
          <label className="label">About me</label>
          <textarea className="input" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={1000} />
        </div>
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <button className="btn-primary">Save profile</button>
      </form>

      <div className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">Contact information</h2>
        <dl className="grid grid-cols-[100px_1fr] gap-2 text-sm">
          <dt className="text-gray-500">Phone</dt>
          <dd>{user.phone ?? "—"} {user.phone_verified_at && "✅"}</dd>
          <dt className="text-gray-500">Email</dt>
          <dd>{user.email ?? "—"} {user.email_verified_at && "✅"}</dd>
          <dt className="text-gray-500">Role</dt>
          <dd className="capitalize">{user.role_name}</dd>
        </dl>
        {!contactSent ? (
          <form onSubmit={requestContact} className="flex gap-2">
            <input className="input" placeholder="New phone or email" value={contact} onChange={(e) => setContact(e.target.value)} required />
            <button className="btn-outline shrink-0">Verify & add</button>
          </form>
        ) : (
          <form onSubmit={verifyContact} className="space-y-3">
            <p className="text-sm">Code sent to <b>{contactSent.target}</b></p>
            <OtpInput value={code} onChange={setCode} devCode={contactSent.dev_code} onResend={() => requestContact()} />
            <button className="btn-primary" disabled={code.length !== 6}>Confirm</button>
          </form>
        )}
        {contactMsg && <Alert kind={contactMsg.kind}>{contactMsg.text}</Alert>}
      </div>

      <form onSubmit={changePassword} className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">Change password</h2>
        <input className="input" type="password" placeholder="Current password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required />
        <input className="input" type="password" placeholder="New password (min 8 characters)" minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required />
        {pwMsg && <Alert kind={pwMsg.kind}>{pwMsg.text}</Alert>}
        <button className="btn-primary">Update password</button>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <Profile />
    </RequireAuth>
  );
}
