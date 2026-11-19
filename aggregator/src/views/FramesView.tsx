import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import type { FrameWidth, Model } from '../lib/models';

export interface Slot {
  key: string;
  label: string;
  modelId: string;
}

interface FramesViewProps {
  title: string;
  slots: Slot[];
  models: Model[];
  width: FrameWidth;
  nonces: Record<string, number>;
  onSelect: (slot: string, modelId: string) => void;
  onReload: (slot: string) => void;
}

const iconProps = {
  viewBox: '0 0 16 16',
  width: 14,
  height: 14,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function ReloadIcon() {
  return (
    <svg {...iconProps}>
      <path d="M13 8a5 5 0 1 1-1.7-3.8" />
      <path d="M13.2 2.6v3.1h-3.1" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9.5 2.5H14v4.5" />
      <path d="M14 2.5 8 8.5" />
      <path d="M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" />
    </svg>
  );
}

export function FramesView({
  title,
  slots,
  models,
  width,
  nonces,
  onSelect,
  onReload,
}: FramesViewProps) {
  const options = models.map((model) => ({ value: model.id, label: model.name }));
  const isDuo = slots.length === 2;

  return (
    <section className="view view--frames" aria-label={title}>
      <div className={isDuo ? 'frames frames--duo' : 'frames frames--quad'}>
        {slots.map((slot) => {
          const model = models.find((entry) => entry.id === slot.modelId);
          return (
            <article className="frame" key={slot.key}>
              <header className="frame__head">
                <span className="frame__no mono">{slot.label}</span>
                <div className="frame__pick">
                  <Selector
                    label={`${slot.label} model`}
                    isLabelHidden
                    options={options}
                    value={slot.modelId}
                    onChange={(modelId: string) => onSelect(slot.key, modelId)}
                    placeholder="Pick a model"
                    size="sm"
                    width="100%"
                  />
                </div>
                <div className="frame__acts">
                  <Button
                    label="Reload"
                    isIconOnly
                    icon={<ReloadIcon />}
                    tooltip="Reload this pane"
                    size="sm"
                    variant="ghost"
                    isDisabled={!model}
                    onClick={() => onReload(slot.key)}
                  />
                  {model ? (
                    <Button
                      label="Open in new tab"
                      isIconOnly
                      icon={<OpenIcon />}
                      tooltip="Open in a new tab"
                      size="sm"
                      variant="ghost"
                      href={model.path}
                      target="_blank"
                      rel="noopener"
                    />
                  ) : null}
                </div>
              </header>
              <div className="frame__viewport" data-width={isDuo ? width : 'desktop'}>
                {model ? (
                  <iframe
                    key={`${model.id}-${nonces[slot.key] ?? 0}`}
                    title={`${model.name} preview at ${model.path}`}
                    src={model.path}
                  />
                ) : (
                  <p className="frame__empty">Pick a model above to load its page here.</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
