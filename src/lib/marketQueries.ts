import { fetchMarkets, fetchSentiment, queryRetry } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useMarketsQuery() {
  return useQuery({
    queryKey: ["markets"],
    queryFn: ({ signal }) => fetchMarkets(signal),
    staleTime: 30_000,
    retry: queryRetry,
  });
}

export function useSentimentQuery() {
  return useQuery({
    queryKey: ["sentiment"],
    queryFn: ({ signal }) => fetchSentiment(signal),
    staleTime: 30_000,
    retry: queryRetry,
  });
}
