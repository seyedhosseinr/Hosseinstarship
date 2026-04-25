import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion, Home, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card variant="glass" className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <FileQuestion className="h-10 w-10 text-primary" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-6xl font-black text-primary">Û´Û°Û´</h1>
            <h2 className="text-xl font-bold">ØµÙØ­Ù‡ Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯</h2>
            <p className="text-muted-foreground text-sm">
              ØµÙØ­Ù‡ Ù…ÙˆØ±Ø¯ Ù†Ø¸Ø± Ø´Ù…Ø§ ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯ ÛŒØ§ Ù…Ù†ØªÙ‚Ù„ Ø´Ø¯Ù‡ Ø§Ø³Øª.
            </p>
          </div>

          <Button asChild variant="default" className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              Ø¨Ø§Ø²Ú¯Ø´Øª Ø¨Ù‡ Ø¯Ø§Ø´Ø¨ÙˆØ±Ø¯
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}