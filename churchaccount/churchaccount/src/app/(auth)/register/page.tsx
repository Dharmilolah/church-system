"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [form, setForm] = useState({
    churchName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    // Generate a short church code
    const churchCode = form.churchName
      .replace(/\s+/g, "-")
      .toUpperCase()
      .slice(0, 12) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

    // Create church first
    const { data: church, error: churchError } = await supabase
      .from("churches")
      .insert({ name: form.churchName, church_code: churchCode })
      .select()
      .single();

    if (churchError) {
      setError(churchError.message);
      setLoading(false);
      return;
    }

    // Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (authError || !authData.user) {
      setError(authError?.message || "Failed to create account");
      setLoading(false);
      return;
    }

    // Insert user record
    await supabase.from("users").insert({
      id: authData.user.id,
      email: form.email,
      role: "admin",
      church_id: church.id,
    });

    // Insert profile record (required for RLS policies)
    await supabase.from("profiles").insert({
      id: authData.user.id,
      role: "admin",
      church_id: church.id,
    });

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Register your church</h2>
      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="label">Church name</label>
          <input
            type="text"
            value={form.churchName}
            onChange={(e) => setForm({ ...form, churchName: e.target.value })}
            className="input"
            placeholder="Grace Community Church"
            required
          />
        </div>
        <div>
          <label className="label">Admin email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input"
            placeholder="admin@church.org"
            required
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="input"
            placeholder="••••••••"
            required
          />
        </div>
        <div>
          <label className="label">Confirm password</label>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            className="input"
            placeholder="••••••••"
            required
          />
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
          Sign in
        </Link>
      </p>
    </>
  );
}
