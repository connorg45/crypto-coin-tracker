import { fetchChart, fetchCoin, queryRetry } from "@/lib/api";
import type { ChartRange } from "@shared/contracts";
import { useQuery } from "@tanstack/react-query";

export function useCoinQuery(coinId: string) {
  return useQuery({
    queryKey: ["coin", coinId],
    queryFn: ({ signal }) => fetchCoin(coinId, signal),
    enabled: coinId.length > 0,
    retry: queryRetry,
  });
}

export function useChartQuery(coinId: string, range: ChartRange) {
  return useQuery({
    queryKey: ["chart", coinId, range],
    queryFn: ({ signal }) => fetchChart(coinId, range, signal),
    enabled: coinId.length > 0,
    placeholderData: (previous) => previous,
    retry: queryRetry,
  });
}
