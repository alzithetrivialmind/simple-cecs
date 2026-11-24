"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginInput } from "@/lib/validations/auth";
import { loginAction } from "@/server/actions/auth";
import { toast } from "sonner";
import Image from "next/image";
import { ORG_NAME } from "@/lib/brand";
import { AppCredit } from "@/components/shared/app-credit";
import { Lock, User, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      nik: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginInput) => {
    setIsLoading(true);
    try {
      const res = await loginAction(values);
      if (res.success) {
        // Full reload supaya layout server membaca cookie sesi yang baru
        window.location.assign("/dashboard");
        return;
      }
      toast.error(res.error || "Gagal masuk. Periksa NIK dan password.");
    } catch {
      toast.error("Terjadi kesalahan pada sistem");
    }
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <Image
            src="/logo.png"
            alt={ORG_NAME}
            width={48}
            height={48}
            priority
            className="mx-auto h-12 w-auto object-contain"
          />
          <div>
            <h1 className="font-condensed text-4xl font-bold leading-none tracking-tight">CECS</h1>
            <p className="mt-1 text-sm text-muted-foreground">Equipment Control System</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Masuk</CardTitle>
            <CardDescription>Pakai NIK dan password Anda.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Form {...form}>
              <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nik"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        NIK
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Contoh: TECH001"
                            className="h-12 pl-10 text-base uppercase placeholder:normal-case"
                            disabled={isLoading}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Password
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="password"
                            placeholder="••••••••"
                            className="h-12 pl-10 text-base"
                            disabled={isLoading}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 h-12 w-full text-base font-semibold"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memverifikasi...
                    </>
                  ) : (
                    "Masuk"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Lupa password? Hubungi admin untuk reset.
        </p>
        <AppCredit />
      </div>
    </div>
  );
}
