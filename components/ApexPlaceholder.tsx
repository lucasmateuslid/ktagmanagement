import * as React from 'react';

export const ApexPlaceholder: React.FC = () => {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-white p-6">
      <div className="max-w-md text-center space-y-8">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <span className="font-display text-3xl font-black text-amber-500 tracking-tighter">
            K
          </span>
        </div>
        <div className="space-y-3">
          <h1 className="font-display text-3xl md:text-4xl font-black uppercase tracking-widest">
            K-Tag Finder
          </h1>
          <p className="text-zinc-400 text-sm">
            Plataforma de gestão e rastreamento de ativos veiculares.
          </p>
          <p className="text-zinc-500 text-xs uppercase tracking-[0.3em] pt-2">
            Em construção
          </p>
        </div>
        <div className="pt-4">
          <a
            href="mailto:contato@ktagfinder.app"
            className="inline-block text-amber-500 hover:text-amber-400 text-sm border-b border-amber-500/30 hover:border-amber-400"
          >
            contato@ktagfinder.app
          </a>
        </div>
      </div>
    </div>
  );
};
