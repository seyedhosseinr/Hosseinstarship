"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Crown, Star } from "lucide-react";

const MOCK_LEADERBOARD = [
  { name: "Ø¯Ú©ØªØ± Ø§Ø­Ù…Ø¯ÛŒ", xp: 12500, level: 25, streak: 45, rank: 1 },
  { name: "Ø¯Ú©ØªØ± Ù…Ø­Ù…Ø¯ÛŒ", xp: 11200, level: 23, streak: 32, rank: 2 },
  { name: "Ø¯Ú©ØªØ± Ø±Ø¶Ø§ÛŒÛŒ", xp: 9800, level: 20, streak: 28, rank: 3 },
  { name: "Ø¯Ú©ØªØ± Ø­Ø³ÛŒÙ†ÛŒ", xp: 8500, level: 17, streak: 21, rank: 4 },
  { name: "Ø¯Ú©ØªØ± Ú©Ø±ÛŒÙ…ÛŒ", xp: 7200, level: 15, streak: 18, rank: 5 },
];

export default function LeaderboardPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <Trophy className="h-8 w-8 text-amber-500" />
          Ù„ÛŒØ¯Ø±Ø¨ÙˆØ±Ø¯
        </h1>
        <p className="text-muted-foreground mt-2">
          Ø±ØªØ¨Ù‡â€ŒØ¨Ù†Ø¯ÛŒ Ø¨Ø± Ø§Ø³Ø§Ø³ Ø§Ù…ØªÛŒØ§Ø² (XP) Ùˆ ÙØ¹Ø§Ù„ÛŒØª.
        </p>
      </div>

      <div className="space-y-3">
        {MOCK_LEADERBOARD.map((user) => (
          <Card
            key={user.rank}
            variant={user.rank <= 3 ? "gradient" : "glass"}
            className="transition-all hover:shadow-md"
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex items-center justify-center h-10 w-10 shrink-0">
                {user.rank === 1 ? (
                  <Crown className="h-8 w-8 text-amber-500" />
                ) : user.rank === 2 ? (
                  <Medal className="h-7 w-7 text-gray-400" />
                ) : user.rank === 3 ? (
                  <Medal className="h-7 w-7 text-amber-700" />
                ) : (
                  <span className="text-lg font-black text-muted-foreground">
                    {user.rank}
                  </span>
                )}
              </div>

              <Avatar size="default">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                  {user.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{user.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Ø³Ø·Ø­ {user.level}</span>
                  <span>â€¢</span>
                  <span>ðŸ”¥ {user.streak} Ø±ÙˆØ²</span>
                </div>
              </div>

              <Badge variant="glow" className="font-mono text-sm px-3">
                {user.xp.toLocaleString("fa-IR")} XP
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}