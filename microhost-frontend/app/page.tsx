import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";

export default function Home() {
    return (
        <div className="flex flex-col flex-1 justify-start items-center bg-white px-2 sm:px-8 py-10 w-full max-w-lg h-full font-sans">
            <h1 className="header">MicroHost</h1>
            <h2 className="subtitle">Registration</h2>
            <div className="mt-2 mb-6 max-w-md line"></div>
            <div className="space-y-4 w-full">
                <div>
                    <Label htmlFor="username">Username</Label>
                    <Input className="w-full" type="text" name="username" placeholder="mycoolusername123" />
                </div>
                <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input className="w-full" type="email" name="email" placeholder="cooolname@provider.com" />
                </div>
                <div>
                    <Label htmlFor="password">Password</Label>
                    <Input className="w-full" type="password" name="password" placeholder="MySuperSecretPassword" />
                </div>
                <Button className="w-full">Register</Button>
            </div>
        </div>
    );
}
