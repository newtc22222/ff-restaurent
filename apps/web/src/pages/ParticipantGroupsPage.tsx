import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, UserRoundCheck } from 'lucide-react';
import { useAppContext } from '../app/providers/app-context';
import { useI18n } from '../app/providers/i18n';
import { useMutation } from '../hooks/useMutation';
import type { ParticipantGroup } from '../lib/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Dropdown from '../components/ui/Dropdown';
import EmptyState from '../components/ui/EmptyState';
import SectionTitle from '../components/ui/SectionTitle';
import Modal from '../components/ui/Modal';

type GroupDraft = { id?: string; name: string; memberIds: string[] };

const emptyDraft = (): GroupDraft => ({ name: '', memberIds: [] });

export default function ParticipantGroupsPage() {
  const { participantGroups, users, user } = useAppContext();
  const { t } = useI18n();
  const { mutate } = useMutation();
  const [draft, setDraft] = useState<GroupDraft>(emptyDraft);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<ParticipantGroup | null>(null);
  const memberOptions = useMemo(
    () =>
      Array.from(
        new Map([user, ...users].map((member) => [member.id, member])).values(),
      )
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((member) => ({
          value: member.id,
          label: member.name,
          description: `@${member.username}`,
          searchText: `${member.name} ${member.username}`,
        })),
    [user, users],
  );
  const editing = Boolean(draft.id);
  const ready = draft.name.trim().length > 0 && draft.memberIds.length >= 2;

  const reset = () => {
    setDraft(emptyDraft());
    setModalOpen(false);
  };
  const edit = (group: ParticipantGroup) => {
    setDraft({
      id: group.id,
      name: group.name,
      memberIds: group.members.map(({ userId }) => userId),
    });
    setModalOpen(true);
  };
  const save = () => {
    if (!ready) return;
    void mutate(
      {
        intent: editing
          ? 'update-participant-group'
          : 'create-participant-group',
        ...(draft.id ? { groupId: draft.id } : {}),
        payload: { name: draft.name.trim(), memberIds: draft.memberIds },
      },
      {
        fallback: t('toast.participantGroupSaveFailed'),
        success: t(editing ? 'groups.updated' : 'toast.participantGroupSaved'),
        onSuccess: reset,
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 py-2">
      <SectionTitle title={t('groups.title')} subtitle={t('groups.subtitle')} />
      <div className="flex justify-end">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setDraft(emptyDraft());
            setModalOpen(true);
          }}
        >
          <Plus size={14} /> {t('groups.create')}
        </button>
      </div>

      <Modal
        open={modalOpen}
        title={t(editing ? 'groups.edit' : 'groups.create')}
        onClose={reset}
      >
        <p className="mb-4 text-sm text-slate-500">{t('groups.formHint')}</p>
        <div className="space-y-4">
          <label className="space-y-1">
            <span className="label">{t('groups.name')}</span>
            <input
              className="field w-full"
              value={draft.name}
              maxLength={80}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <label className="space-y-1">
            <span className="label">{t('groups.members')}</span>
            <Dropdown
              multiple
              label={t('groups.chooseMembers')}
              ariaLabel={t('groups.chooseMembers')}
              values={draft.memberIds}
              onChange={(memberIds) =>
                setDraft((current) => ({ ...current, memberIds }))
              }
              options={memberOptions}
              searchable
              searchPlaceholder={t('bills.searchMembers')}
              emptyMessage={t('bills.noFilterResults')}
              allowClear
              clearLabel={t('bills.clearAll')}
              formatSelection={(selected) =>
                `${selected.length} ${t('groups.membersSelected')}`
              }
            />
          </label>
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!ready}
            onClick={save}
          >
            {editing ? <Pencil size={14} /> : <Plus size={14} />}
            {t(editing ? 'common.save' : 'groups.create')}
          </button>
        </div>
      </Modal>

      <section className="space-y-3">
        {participantGroups.length === 0 && (
          <EmptyState
            icon={UserRoundCheck}
            title={t('groups.empty')}
            description={t('groups.emptyHint')}
            steps={[]}
          />
        )}
        {participantGroups.map((group) => (
          <article
            key={group.id}
            className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <h3 className="font-bold text-ink">{group.name}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {group.members.map(({ userId, user: member }) => (
                  <span
                    key={userId}
                    className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    {member.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => edit(group)}
              >
                <Pencil size={13} /> {t('groups.edit')}
              </button>
              <button
                type="button"
                className="btn btn-soft text-red-600"
                onClick={() => setDeleting(group)}
              >
                <Trash2 size={13} /> {t('common.remove')}
              </button>
            </div>
          </article>
        ))}
      </section>

      {deleting && (
        <ConfirmDialog
          title={t('groups.delete')}
          message={t('groups.confirmDelete')}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const groupId = deleting.id;
            setDeleting(null);
            void mutate(
              { intent: 'delete-participant-group', groupId },
              {
                fallback: t('toast.participantGroupDeleteFailed'),
                success: t('toast.participantGroupDeleted'),
                onSuccess: () => {
                  if (draft.id === groupId) reset();
                },
              },
            );
          }}
          t={t}
        />
      )}
    </div>
  );
}
