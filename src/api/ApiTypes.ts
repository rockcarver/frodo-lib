export interface NoIdObjectSkeletonInterface {
  _rev?: string;
  [k: string]:
    | string
    | number
    | boolean
    | string[]
    | IdObjectSkeletonInterface
    | object
    | undefined;
}

export interface IdObjectSkeletonInterface extends NoIdObjectSkeletonInterface {
  _id?: string;
}

export type Readable<Type> = Type;

export type Writable<Type> = {
  inherited: boolean;
  value?: Type;
};

export type QueryResult<Type> = {
  result: Type[];
};

export type PagedResult<Type> = {
  result: Type[];
  resultCount: number;
  pagedResultsCookie: string;
  totalPagedResultsPolicy: 'EXACT';
  totalPagedResults: number;
  remainingPagedResults: number;
};
