import { useMemo } from 'react';

interface ChartDataItem {
  value: number;
}

interface ChartState<T> {
  isEmpty: boolean;
  isSparse: boolean;
  isReady: boolean;
  data: T[];
  nonEmptyCount: number;
}

export default function useChartState<T extends ChartDataItem>(
  data: T[],
  minForChart: number = 3,
): ChartState<T> {
  return useMemo(() => {
    const nonEmpty = data.filter((d) => d.value > 0);

    return {
      isEmpty: nonEmpty.length === 0,
      isSparse: nonEmpty.length > 0 && nonEmpty.length < minForChart,
      isReady: nonEmpty.length >= minForChart,
      data,
      nonEmptyCount: nonEmpty.length,
    };
  }, [data, minForChart]);
}
