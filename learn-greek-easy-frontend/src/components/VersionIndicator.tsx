/**
 * VersionIndicator - Small version indicator shown in bottom-right corner
 *
 * Displays the commit SHA (first 7 chars) to verify which code is deployed.
 * Styled to be barely visible (small, grey text).
 */

const VersionIndicator = () => {
  const commitSha = import.meta.env.VITE_COMMIT_SHA || 'dev';
  const shortSha = commitSha.substring(0, 7);

  return (
    <div
      className="fixed bottom-2 right-2 z-50 select-none text-[10px] text-gray-400/50 hover:text-gray-400"
      title={`Build: ${commitSha}`}
    >
      {shortSha}
    </div>
  );
};

export default VersionIndicator;
