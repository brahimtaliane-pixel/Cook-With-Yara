"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ThemeData {
  theme: string;
  count: number;
  avgScore: number;
  example: string;
}

function getScoreColor(score: number) {
  if (score >= 90) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 70) return "text-blue-700 dark:text-blue-400";
  if (score >= 50) return "text-amber-700 dark:text-amber-400";
  return "text-muted-foreground";
}

export function AnalyticsThemes({ themes }: { themes: ThemeData[] }) {
  if (themes.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Not enough data to identify recurring themes. Themes require at least 3
        appearances of a term pair.
      </p>
    );
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Content Themes</CardTitle>
        <CardDescription className="text-xs">
          Recurring topic pairs from pin titles (minimum 3 appearances)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Theme</TableHead>
              <TableHead className="text-right text-xs">Appearances</TableHead>
              <TableHead className="text-right text-xs">Avg Score</TableHead>
              <TableHead className="text-xs">Example Pin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {themes.map((t) => (
              <TableRow key={t.theme}>
                <TableCell className="text-xs font-medium">{t.theme}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {t.count}
                </TableCell>
                <TableCell
                  className={`text-right text-xs font-semibold tabular-nums ${getScoreColor(t.avgScore)}`}
                >
                  {t.avgScore}
                </TableCell>
                <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground">
                  {t.example}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
