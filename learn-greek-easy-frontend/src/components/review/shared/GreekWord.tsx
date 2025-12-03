interface GreekWordProps {
  word: string;
  pronunciation: string;
}

export function GreekWord({ word, pronunciation }: GreekWordProps) {
  return (
    <div className="mb-4">
      <h1 className="mb-3 text-5xl font-bold leading-tight text-gray-900">{word}</h1>
      <p className="text-lg italic text-gray-500">{pronunciation}</p>
    </div>
  );
}
