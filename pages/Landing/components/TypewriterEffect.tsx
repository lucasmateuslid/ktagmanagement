import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';

interface Word {
  text: string;
  className?: string;
}

interface TypewriterEffectSmoothProps {
  words: Word[];
  className?: string;
  cursorClassName?: string;
}

export function TypewriterEffectSmooth({
  words,
  className,
  cursorClassName,
}: TypewriterEffectSmoothProps) {
  const wordsArray = words.map((word) => ({
    ...word,
    text: word.text.split(''),
  }));

  const renderWords = () => (
    <div className="inline-block">
      {wordsArray.map((word, idx) => (
        <div key={`word-${idx}`} className="inline-block">
          {word.text.map((char, index) => (
            <span key={`char-${index}`} className={cn('text-white', word.className)}>
              {char}
            </span>
          ))}
          &nbsp;
        </div>
      ))}
    </div>
  );

  return (
    <div className={cn('flex space-x-1 justify-center my-6', className)}>
      <motion.div
        className="overflow-hidden pb-2"
        initial={{ width: '0%' }}
        whileInView={{ width: 'fit-content' }}
        transition={{ duration: 2, ease: 'linear', delay: 0.5 }}
      >
        <div
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold"
          style={{ whiteSpace: 'nowrap' }}
        >
          {renderWords()}{' '}
        </div>
      </motion.div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
        className={cn(
          'block rounded-sm w-[4px] h-8 sm:h-10 md:h-12 lg:h-14 bg-[#F5A623] mt-1 shrink-0',
          cursorClassName,
        )}
      />
    </div>
  );
}
