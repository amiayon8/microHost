"use client"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner"
import axios from "axios";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react"

export default function Registration() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL!;
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    let shouldLogin = false;

    try {
      await axios.post(`${API_URL}/register`, {
        username,
        email,
        password,
      });

      toast.success("Registration Successful");
      shouldLogin = true;
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : detail?.[0]?.msg ?? "Unknown Error";

      if (message === "Email already registered") {
        shouldLogin = true;
      } else {
        toast.error(message);
      }
    }

    if (shouldLogin) {
      try {
        await axios.post(`${API_URL}/token`, {
          username,
          password,
        });

      } catch (err: any) {
        const detail = err.response?.data?.detail;
        const message =
          typeof detail === "string"
            ? detail
            : detail?.[0]?.msg ?? "Unknown Error";

        toast.error(message);
      }
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col flex-1 justify-start items-center bg-white px-2 sm:px-8 py-10 w-full max-w-lg h-full font-sans">
      <h1 className="header">MicroHost</h1>
      <h2 className="subtitle">Registration</h2>
      <div className="mt-2 mb-6 max-w-md line"></div>
      {registrationSuccess ? (
        <div className="flex flex-col justify-center items-center gap-8 pt-8 w-full h-full">
          <CheckCircle className="w-3/8 h-auto" />
          <p>Registration successfull. Logging you in...</p>

        </div>
      ) : (
        <>
          <div className="space-y-4 mb-6 w-full">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input required onChange={(e) => setUsername(e.target.value)} className="w-full" type="text" name="username" placeholder="mycoolusername123" />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input required onChange={(e) => setEmail(e.target.value)} className="w-full" type="email" name="email" placeholder="cooolname@provider.com" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input required onChange={(e) => setPassword(e.target.value)} className="w-full" type="password" name="password" placeholder="MySuperSecretPassword" />
            </div>
            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading && (<Spinner />)}Register</Button>
          </div>
          <p>Already an user? <a href="/login" className="hover:decoration-0 underline">Login</a></p>
        </>
      )}
    </div>
  );
}
