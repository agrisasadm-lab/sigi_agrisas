import type { FolioScope } from "./domain";

export interface FolioDto {
  id: string;
  code: string;
  name: string;
  prefix: string | null;
  scope: FolioScope;
  currentNumber: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branchCurrentNumber: number | null;
  nextFolioCode: string | null;
}

export interface ListFoliosResponse {
  items: FolioDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateFolioBody {
  code: string;
  name: string;
  scope: FolioScope;
  prefix?: string | null;
  currentNumber?: number;
  isActive?: boolean;
}

export interface UpdateFolioBody {
  name?: string;
  prefix?: string | null;
  scope?: FolioScope;
  currentNumber?: number;
  isActive?: boolean;
}
