"use client";

import { Badge } from "@/components/ui/badge";
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

interface BoardData {
  boardName: string;
  count: number;
  totalSaves: number;
  avgVelocity: number;
  topScore: number;
  topTier: string;
  topTierColor: string;
}

function getTierBadgeStyle(tierColor: string) {
  switch (tierColor) {
    case "emerald":
      return "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "blue":
      return "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400";
    case "amber":
      return "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400";
    default:
      return "border-muted bg-muted/50 text-muted-foreground";
  }
}

export function AnalyticsBoards({ boards }: { boards: BoardData[] }) {
  if (boards.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No board data for this period.
      </p>
    );
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Board Analysis</CardTitle>
        <CardDescription className="text-xs">
          Performance breakdown by Pinterest board
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Board</TableHead>
              <TableHead className="text-right text-xs">Pins</TableHead>
              <TableHead className="text-right text-xs">Total Saves</TableHead>
              <TableHead className="text-right text-xs">Avg Velocity</TableHead>
              <TableHead className="text-right text-xs">Top Score</TableHead>
              <TableHead className="text-right text-xs">Best Tier</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {boards.map((board) => (
              <TableRow key={board.boardName}>
                <TableCell className="max-w-[200px] truncate text-xs font-medium">
                  {board.boardName}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {board.count}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {board.totalSaves.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {board.avgVelocity}/day
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {board.topScore}
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant="outline"
                    className={`text-[11px] ${getTierBadgeStyle(board.topTierColor)}`}
                  >
                    {board.topTier}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
