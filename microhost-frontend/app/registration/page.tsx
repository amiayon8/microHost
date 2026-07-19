"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import axios from "axios";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Registration() {
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {

    const token = localStorage.getItem("access_token");

    if (token) router.push('/dashboard')

  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    let shouldLogin = false;

    try {
      await axios.post(`${API_URL}/register`, {
        username,
        email,
        password,
      });

      toast.success("Registration Successful");
      setRegistrationSuccess(true);
      shouldLogin = true;
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : detail?.[0]?.msg ?? "An unknown error occurred during registration.";

      if (message === "Email already registered") {
        toast.info("Account already exists. Logging you in...");
        shouldLogin = true;
      } else {
        toast.error(message);
      }
    }

    if (shouldLogin) {
      try {
        const formData = new URLSearchParams();
        formData.append("username", username || email);
        formData.append("password", password);

        const response = await axios.post(`${API_URL}/token`, formData, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        const token = response.data.access_token;

        localStorage.setItem("access_token", token);

        toast.success("Logged in successfully!");
        setRegistrationSuccess(true);

        router.push("/dashboard");
      } catch (err: any) {
        const detail = err.response?.data?.detail;
        const message =
          typeof detail === "string"
            ? detail
            : detail?.[0]?.msg ?? "An unknown error occurred during login.";

        toast.error(message);
        setRegistrationSuccess(false);
      }
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col flex-1 justify-start items-center bg-white px-2 sm:px-8 py-10 w-full max-w-lg h-full font-sans">
      <h1 className="font-bold text-2xl header">MicroHost</h1>
      <h2 className="text-gray-500 text-lg subtitle">Registration</h2>
      <div className="mt-2 mb-6 border-gray-200 border-b w-full max-w-md"></div>

      {registrationSuccess ? (
        <div className="flex flex-col justify-center items-center gap-6 pt-8 w-full h-full text-center">
          <CheckCircle className="w-24 h-24 text-green-500" />
          <p className="font-medium text-lg">
            Registration successful. Logging you in...
          </p>
          <Spinner />
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4 mb-6 w-full">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                required
                disabled={loading}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full"
                type="text"
                name="username"
                placeholder="mycoolusername123"
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                required
                disabled={loading}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
                type="email"
                name="email"
                placeholder="coolname@provider.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                required
                disabled={loading}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
                type="password"
                name="password"
                placeholder="MySuperSecretPassword"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Spinner className="mr-2" />}
              {loading ? "Registering..." : "Register"}
            </Button>
          </form>
          <p className="text-sm">
            Already a user?{" "}
            <a href="/login" className="text-blue-600 hover:underline">
              Login
            </a>
          </p>
        </>
      )}
    </div>
  );
}