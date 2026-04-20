export interface Group {
  id: string;
  name: string;
  subName?: string;
  imageUrl: string;
}

export interface Award {
  id: string;
  name: string;
}

export type Votes = Record<string, Record<string, number>>;
