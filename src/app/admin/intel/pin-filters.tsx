"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PinFiltersProps {
  onChange: (filters: {
    minSaves?: number;
    minScore?: number;
    sort?: string;
  }) => void;
}

export function PinFilters({ onChange }: PinFiltersProps) {
  const [minSaves, setMinSaves] = useState("");
  const [minScore, setMinScore] = useState("");
  const [sort, setSort] = useState("score");

  function emitChange(overrides: { minSaves?: string; minScore?: string; sort?: string }) {
    const nextMinSaves = overrides.minSaves ?? minSaves;
    const nextMinScore = overrides.minScore ?? minScore;
    const nextSort = overrides.sort ?? sort;
    onChange({
      minSaves: nextMinSaves ? Number(nextMinSaves) : undefined,
      minScore: nextMinScore ? Number(nextMinScore) : undefined,
      sort: nextSort,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        type="number"
        placeholder="Min saves"
        value={minSaves}
        onChange={(e) => {
          setMinSaves(e.target.value);
          emitChange({ minSaves: e.target.value });
        }}
        className="w-28"
      />
      <Input
        type="number"
        placeholder="Min score"
        value={minScore}
        onChange={(e) => {
          setMinScore(e.target.value);
          emitChange({ minScore: e.target.value });
        }}
        className="w-28"
      />
      <Select
        defaultValue="score"
        onValueChange={(val) => {
          const v = val ?? "score";
          setSort(v);
          emitChange({ sort: v });
        }}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="score">Score</SelectItem>
          <SelectItem value="velocity">Velocity</SelectItem>
          <SelectItem value="acceleration">Acceleration</SelectItem>
          <SelectItem value="saves">Saves</SelectItem>
          <SelectItem value="date">Date</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
