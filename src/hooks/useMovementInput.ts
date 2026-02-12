import { useCallback, useEffect, useRef } from 'react';

interface MovementInput {
  forward: number;
  right: number;
  sprint: boolean;
  hasInput: boolean;
}

const FORWARD_KEYS = ['KeyW', 'ArrowUp'];
const BACKWARD_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable
  );
}

export function useMovementInput() {
  const pressedRef = useRef(new Set<string>());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      pressedRef.current.add(event.code);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      pressedRef.current.delete(event.code);
    };

    const onBlur = () => {
      pressedRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const getMovementInput = useCallback((): MovementInput => {
    const pressed = pressedRef.current;
    const forward =
      Number(FORWARD_KEYS.some((key) => pressed.has(key))) -
      Number(BACKWARD_KEYS.some((key) => pressed.has(key)));
    const right =
      Number(RIGHT_KEYS.some((key) => pressed.has(key))) -
      Number(LEFT_KEYS.some((key) => pressed.has(key)));
    const sprint = pressed.has('ShiftLeft') || pressed.has('ShiftRight');

    return {
      forward,
      right,
      sprint,
      hasInput: forward !== 0 || right !== 0,
    };
  }, []);

  return { getMovementInput };
}
