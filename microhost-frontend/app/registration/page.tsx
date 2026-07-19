"use client"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import axios from "axios";
import { useState } from "react";

export default function Registration() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL!;
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const res = await axios.post(`${API_URL}/register`, {
      username,
      email,
      password,
    });

    console.log(res.data);
  };

  return (
    <div className="flex flex-col flex-1 justify-start items-center bg-white px-2 sm:px-8 py-10 w-full max-w-lg h-full font-sans">
      <h1 className="header">MicroHost</h1>
      <h2 className="subtitle">Registration</h2>
      <div className="mt-2 mb-6 max-w-md line"></div>
      <div className="space-y-4 mb-6 w-full">
        <div>
          <Label htmlFor="username">Username</Label>
          <Input onChange={(e) => setUsername(e.target.value)} className="w-full" type="text" name="username" placeholder="mycoolusername123" />
        </div>
        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input onChange={(e) => setEmail(e.target.value)} className="w-full" type="email" name="email" placeholder="cooolname@provider.com" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input onChange={(e) => setPassword(e.target.value)} className="w-full" type="password" name="password" placeholder="MySuperSecretPassword" />
        </div>
        <Button onClick={handleSubmit} className="w-full">Register</Button>
      </div>
      <p>Already an user? <a href="/login" className="hover:decoration-0 underline">Login</a></p>
    </div>
  );
}
