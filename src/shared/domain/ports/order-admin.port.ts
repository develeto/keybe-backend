export interface OrderAdminPort {
  findAll(
    limit?: number,
    offset?: number,
    statusFilter?: string
  ): Promise<{
    orders: Array<{
      id: number;
      user_id: number;
      status: string;
      total: number;
      items: string;
      created_at: Date;
      updated_at: Date;
    }>;
    total: number;
  }>;

  findById(id: number): Promise<{
    id: number;
    status: string;
    items: string;
  } | null>;

  updateStatus(id: number, status: string): Promise<void>;
}
