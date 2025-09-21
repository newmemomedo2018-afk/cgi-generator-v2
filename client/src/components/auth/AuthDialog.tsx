import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

interface AuthDialogProps {
  children: React.ReactNode;
  defaultTab?: "login" | "register";
}

export function AuthDialog({ children, defaultTab = "login" }: AuthDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">(defaultTab);

  const handleSuccess = () => {
    setOpen(false);
    // Redirect to dashboard after successful login/register
    setTimeout(() => window.location.href = "/dashboard", 100);
  };

  const switchToLogin = () => setActiveTab("login");
  const switchToRegister = () => setActiveTab("register");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-0 bg-transparent border-none">
        <VisuallyHidden>
          <DialogTitle>
            {activeTab === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </DialogTitle>
        </VisuallyHidden>
        {activeTab === "login" ? (
          <LoginForm 
            onSuccess={handleSuccess}
            onSwitchToRegister={switchToRegister}
          />
        ) : (
          <RegisterForm 
            onSuccess={handleSuccess}
            onSwitchToLogin={switchToLogin}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
