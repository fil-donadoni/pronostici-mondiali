import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
    return (
        <main className="flex-1 flex items-center justify-center p-4">
            <AuthForm mode="login" />
        </main>
    );
}
