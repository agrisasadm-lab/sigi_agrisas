"use client";

import { Avatar } from "../../../_components/atoms/Avatar/Avatar";
import { Badge } from "../../../_components/atoms/Badge/Badge";
import { IconButton } from "../../../_components/atoms/IconButton/IconButton";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
import type { User } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";

function formatRelativeDate(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months === 1) return "Hace 1 mes";
  if (months < 12) return `Hace ${months} meses`;
  const years = Math.floor(months / 12);
  return `Hace ${years} año${years > 1 ? "s" : ""}`;
}

interface UsersTableProps {
  users: User[];
  currentUserId: string;
  canWrite: boolean;
  isLoading?: boolean;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onEnter?: (user: User) => void;
}

export function UsersTable({
  users,
  currentUserId,
  canWrite,
  isLoading,
  onEdit,
  onDelete,
  onEnter,
}: UsersTableProps) {
  const noop = () => {};
  const { getRowProps } = useTableKeyboard(users, onEnter ?? noop);
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={56} className="w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="text-body-md">
        <THead>
          <Tr hoverable={false}>
            <Th>Usuario</Th>
            <Th>Email</Th>
            <Th>Roles</Th>
            <Th>Creado</Th>
            {canWrite && <Th align="right">Acciones</Th>}
          </Tr>
        </THead>
        <TBody>
          {users.map((user, idx) => {
            const isSelf = user.id === currentUserId;
            return (
              <Tr
                key={user.id}
                {...getRowProps(idx)}
                className="border-b border-outline-variant last:border-0 focus:bg-surface-container focus:outline-none cursor-default"
              >
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar src={user.avatarUrl} alt={user.name ?? user.email} size="sm" fallbackInitials={(user.name ?? user.email)[0].toUpperCase()} />
                    <span className="text-on-surface font-medium">{user.name ?? <span className="text-on-surface-variant">—</span>}</span>
                  </div>
                </Td>
                <Td className="text-on-surface-variant">{user.email}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {user.roles.length === 0 ? (
                      <span className="text-on-surface-variant">—</span>
                    ) : (
                      user.roles.map((role) => (
                        <Badge key={role} variant="neutral">{role}</Badge>
                      ))
                    )}
                  </div>
                </Td>
                <Td>
                  <span title={user.createdAt.toISOString()} className="text-on-surface-variant text-label-lg cursor-help">
                    {formatRelativeDate(user.createdAt)}
                  </span>
                </Td>
                {canWrite && (
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        icon="edit"
                        iconSize={18}
                        ariaLabel={isSelf ? "No puedes editar tu propia cuenta" : "Editar usuario"}
                        onClick={() => onEdit(user)}
                        disabled={isSelf}
                        title={isSelf ? "No puedes editar tu propia cuenta" : "Editar usuario"}
                        className="rounded p-2 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                      <IconButton
                        icon="delete"
                        iconSize={18}
                        ariaLabel={isSelf ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
                        onClick={() => onDelete(user)}
                        disabled={isSelf}
                        title={isSelf ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
                        className="rounded p-2 hover:bg-error-container hover:text-error disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </div>
                  </Td>
                )}
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
