import { StatusBadge } from './status-badge';
import { getDashboardDeploymentProfile } from '../lib/deployment';

export function DeploymentTruthBanner(
  { compact = false }: { compact?: boolean },
): JSX.Element {
  const profile = getDashboardDeploymentProfile();

  return (
    <section className={`deployment-truth${compact ? ' deployment-truth--compact' : ''}`}>
      <div className="deployment-truth__header">
        <div>
          <p className="eyebrow">Deployment Truth</p>
          <h2>{profile.environmentLabel}</h2>
          <p className="deployment-truth__summary">
            {profile.readinessTruth}
          </p>
        </div>
        <div className="deployment-truth__badges">
          <StatusBadge label={profile.executionBadge} tone="warn" />
          <span className="truth-chip">Render runtime truth</span>
        </div>
      </div>

      <div className="deployment-truth__grid">
        <div className="deployment-truth__card">
          <p className="deployment-truth__label">Supported now</p>
          <ul className="deployment-truth__list">
            {profile.supportedExecutionScope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="deployment-truth__card">
          <p className="deployment-truth__label">Still blocked</p>
          <ul className="deployment-truth__list">
            {profile.blockedExecutionScope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
