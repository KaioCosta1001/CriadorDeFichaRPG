"use client";

import { Chip } from "@mui/material";

import { getSystem, getTemplate } from "@/config/systems";
import { MAX_ITEMS, MAX_WEAPONS, ROLL_HISTORY_LIMIT } from "@/config/constants";
import type { Sheet } from "@/schemas";

/**
 * Resumo somente-leitura dos dados da ficha.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PROVISÓRIO — será substituído pelos blocos reais nas Fases 4 a 8.
 * Existe para confirmar de ponta a ponta que o modelo do sistema foi aplicado
 * e que a persistência funciona: se esta tela mostra os atributos certainados,
 * o caminho criar → salvar → ler está inteiro.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function SheetOverview({ sheet }: { sheet: Sheet }) {
  const system = getSystem(sheet.system);
  const template = getTemplate(sheet.system, sheet.templateId);

  const enabledSlots = sheet.profile.slots.filter((slot) => slot.enabled);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Perfil">
        <p className="text-text-muted text-sm">
          Sistema: <strong>{system?.label ?? sheet.system}</strong> · Modelo:{" "}
          <strong>{template?.label ?? sheet.templateId}</strong>
        </p>
        <dl className="mt-3 flex flex-col gap-2">
          {enabledSlots.map((slot) => (
            <div
              key={slot.id}
              className="bg-surface-sunken flex items-center justify-between rounded-lg px-3 py-2"
            >
              <dt className="text-sm font-semibold">
                {slot.label || "(sem rótulo)"}
              </dt>
              <dd className="font-mono">{slot.value || "—"}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel
        title={`Atributos (${sheet.attributes.length})`}
        hint={`Regra: ${system?.attributeRuleDescription ?? "—"}`}
      >
        {sheet.attributes.length === 0 ? (
          <Empty>Nenhum atributo neste modelo.</Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {sheet.attributes.map((attribute) => {
              const contribution = system?.attributeContribution(
                attribute.value,
                { systemId: sheet.system, kind: "skill" },
              );
              return (
                <li
                  key={attribute.id}
                  className="border-border rounded-lg border px-3 py-2"
                >
                  <p className="text-sm font-semibold">{attribute.name}</p>
                  <p className="font-mono text-lg">{attribute.value}</p>
                  <p className="text-text-muted text-xs">
                    soma{" "}
                    {contribution !== undefined && contribution >= 0 ? "+" : ""}
                    {contribution ?? "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title={`Perícias (${sheet.skills.length})`}>
        {sheet.skills.length === 0 ? (
          <Empty>Nenhuma perícia neste modelo.</Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {sheet.skills.map((skill) => {
              return (
                <li
                  key={skill.id}
                  className="odd:bg-surface-sunken flex items-baseline justify-between gap-2 rounded px-2 py-1 text-sm"
                >
                  <span>{skill.name}</span>
                  <span className="font-mono">{skill.value}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel
        title="Inventário"
        hint={`${sheet.inventory.weapons.length}/${MAX_WEAPONS} armas · ${sheet.inventory.items.length}/${MAX_ITEMS} itens`}
      >
        <div className="flex flex-col gap-1 text-sm">
          <p>
            <strong>{sheet.inventory.money.label}:</strong>{" "}
            <span className="font-mono">{sheet.inventory.money.value}</span>
          </p>
          <p>
            <strong>Capacidade de carga:</strong>{" "}
            <span className="font-mono">{sheet.inventory.carryCapacity}</span>
          </p>
          <p>
            <strong>Venda de itens:</strong>{" "}
            {sheet.settings.sellEnabled ? "habilitada" : "desabilitada"}
          </p>
        </div>
        {sheet.inventory.weapons.map((weapon) => (
          <div
            key={weapon.id}
            className="bg-surface-sunken mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          >
            <span className="font-semibold">
              {weapon.name || "(arma sem nome)"}
            </span>
            <Chip size="small" label={`${weapon.diceCount}${weapon.die}`} />
            {weapon.attackBonus !== 0 ? (
              <Chip
                size="small"
                variant="outlined"
                label={`bônus ${weapon.attackBonus}`}
              />
            ) : null}
          </div>
        ))}
      </Panel>

      <Panel
        title="Blocos extras"
        hint={sheet.extraPanels.length === 0 ? "—" : undefined}
      >
        {sheet.extraPanels.length === 0 ? (
          <Empty>
            Nenhum bloco extra ainda (chega no Editar Geral, Fase 4).
          </Empty>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {sheet.extraPanels.map((panel) => (
              <li key={panel.id}>
                <strong>{panel.title}</strong>{" "}
                <Chip size="small" label={panel.type} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Rolagens"
        hint={`Histórico guarda até ${ROLL_HISTORY_LIMIT}`}
      >
        {sheet.rollHistory.length === 0 ? (
          <Empty>Nenhuma rolagem ainda.</Empty>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {sheet.rollHistory.map((roll) => (
              <li key={roll.id} className="bg-surface-sunken rounded px-3 py-1">
                {roll.label}:{" "}
                <span className="font-mono">
                  {roll.dice.join(" + ")} = {roll.total}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-surface rounded-xl border p-4">
      <header className="mb-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {hint ? <p className="text-text-muted text-xs">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-text-muted text-sm">{children}</p>;
}
