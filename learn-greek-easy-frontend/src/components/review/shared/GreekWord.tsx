interface GreekWordProps {
  word: string;
  pronunciation: string;
}

export function GreekWord({ word, pronunciation }: GreekWordProps) {
  return (
    <div className="mb-4">
      <h1 className="text-5xl font-bold text-gray-900 mb-3 leading-tight">
        {word}
      </h1>
      <p className="text-lg text-gray-500 italic">{pronunciation}</p>
    </div>
  );
}
