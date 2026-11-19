import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { ReactNode } from 'react';
import type { Filters, LoadState, Model, Telemetry } from '../lib/models';
import { StatusPill } from '../components/StatusPill';

interface IndexViewProps {
  models: Model[];
  load: LoadState;
  loadError: string;
  telemetry: Record<string, Telemetry>;
  filters: Filters;
  onFilters: (next: Filters) => void;
  onCompare: (id: string) => void;
}

const pad = (value: number) => String(value).padStart(2, '0');

export function IndexView({
  models,
  load,
  loadError,
  telemetry,
  filters,
  onFilters,
  onCompare,
}: IndexViewProps) {
  const query = filters.q.trim().toLowerCase();
  const rows = models.filter((model) => {
    if (filters.tag !== 'ALL' && model.tag !== filters.tag) return false;
    if (!query) return true;
    return [model.name, model.id, model.tag, String(model.port)].some((field) =>
      String(field).toLowerCase().includes(query),
    );
  });

  const tags = [...new Set(models.map((model) => model.tag))].sort((a, b) => a.localeCompare(b));
  const providerOptions = [
    { value: 'ALL', label: 'All providers' },
    ...tags.map((tag) => ({ value: tag, label: tag })),
  ];
  return (
    <section className="view" aria-label="Index">
      <div className="toolbar">
        <div className="toolbar__search">
          <TextInput
            label="Search"
            isLabelHidden
            type="search"
            placeholder="name, folder, port"
            value={filters.q}
            onChange={(value: string) => onFilters({ ...filters, q: value })}
            width="100%"
          />
        </div>

        <div className="toolbar__provider">
          <Selector
            label="Provider"
            isLabelHidden
            options={providerOptions}
            value={filters.tag}
            onChange={(value: string) => onFilters({ ...filters, tag: value })}
            size="sm"
            width="100%"
          />
        </div>

      </div>

      {load === 'loading' ? (
        <StateBlock
          title="Reading the model list"
          body={
            <>
              Fetching <code>/models.json</code> from this Caddy route.
            </>
          }
        />
      ) : null}

      {load === 'error' ? (
        <StateBlock
          title="The model list could not be read"
          body={
            <>
              <code>{loadError}</code>. Caddy serves this page, so <code>/models.json</code> has to
              sit next to <code>index.html</code>.
            </>
          }
          action={
            <Button label="Try again" variant="primary" size="sm" onClick={() => location.reload()} />
          }
        />
      ) : null}

      {load === 'ready' && models.length === 0 ? (
        <StateBlock
          title="No models in the list"
          body={
            <>
              <code>/models.json</code> parsed as an empty array, so there is nothing to route to
              yet. Add a model to that file, then reload.
            </>
          }
        />
      ) : null}

      {load === 'ready' && models.length > 0 && rows.length === 0 ? (
        <StateBlock
          title="No model matches these filters"
          body={
            <>
              Nothing matched <code>{filters.q || 'the current selection'}</code>. Clear the filters
              to see all {models.length} models.
            </>
          }
          action={
            <Button
              label="Clear filters"
              size="sm"
              onClick={() => onFilters({ q: '', tag: 'ALL' })}
            />
          }
        />
      ) : null}

      {load === 'ready' && rows.length > 0 ? (
        <ol className="roster">
          <li className="roster__head" aria-hidden="true">
            <span>№</span>
            <span>Model</span>
            <span className="cell--tag">Provider</span>
            <span className="cell--route">Route</span>
            <span>Status</span>
            <span className="cell--acts">Actions</span>
          </li>
          {rows.map((model) => {
            const index = models.indexOf(model);
            return (
              <li className="row" key={model.id}>
                <span className="row__no mono">{pad(index + 1)}</span>
                <span className="row__ident">
                  <span className="row__name">{model.name}</span>
                  <span className="row__id mono">{model.id}</span>
                </span>
                <span className="row__tag cell--tag">{model.tag}</span>
                <a
                  className="row__route mono cell--route"
                  href={model.path}
                  target="_blank"
                  rel="noopener"
                  title={`Open ${model.name} in a new tab`}
                >
                  {model.path}
                </a>
                <StatusPill telemetry={telemetry[model.id]} />
                <span className="row__acts cell--acts">
                  <Button
                    label="Compare"
                    size="sm"
                    variant="ghost"
                    onClick={() => onCompare(model.id)}
                  />
                  <Button
                    label="Open in tab"
                    size="sm"
                    variant="ghost"
                    href={model.path}
                    target="_blank"
                    rel="noopener"
                  />
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

function StateBlock({
  title,
  body,
  action,
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <Text as="h3" size="xl" weight="normal" className="display">
        {title}
      </Text>
      <Text as="p" size="sm" color="secondary" className="state__body">
        {body}
      </Text>
      {action ? <div className="state__acts">{action}</div> : null}
    </div>
  );
}
