// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BrazilianDocumentInput } from './brazilian-document-input';
import { BrazilianPhoneInput } from './brazilian-phone-input';

afterEach(cleanup);

function ControlledDocument({ kind = 'cpf' }: { kind?: 'cpf' | 'cnpj' }) {
  const [value, setValue] = React.useState('');
  return <BrazilianDocumentInput aria-label="Documento" kind={kind} value={value} onValueChange={setValue} />;
}

function ControlledPhone() {
  const [value, setValue] = React.useState('');
  return <BrazilianPhoneInput aria-label="Telefone" value={value} onValueChange={setValue} />;
}

describe('BrazilianDocumentInput', () => {
  it('mascara, espera o CPF ficar completo, valida e remove o erro em tempo real', () => {
    render(<ControlledDocument />);
    const input = screen.getByLabelText('Documento');

    fireEvent.change(input, { target: { value: '5299822472' } });
    expect((input as HTMLInputElement).value).toBe('529.982.247-2');
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.change(input, { target: { value: '52998224724' } });
    expect(screen.getByRole('alert').textContent).toContain('CPF inválido');

    fireEvent.change(input, { target: { value: '52998224725' } });
    expect((input as HTMLInputElement).value).toBe('529.982.247-25');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('usa o erro de repetição somente para repetição total', () => {
    render(<ControlledDocument />);
    const input = screen.getByLabelText('Documento');

    fireEvent.change(input, { target: { value: '11122233344' } });
    expect(screen.getByRole('alert').textContent).toBe('CPF inválido. Verifique os dígitos informados.');

    fireEvent.change(input, { target: { value: '11111111111' } });
    expect(screen.getByRole('alert').textContent).toBe('CPF não pode ter todos os dígitos iguais.');
  });

  it('valida CNPJ completo e aceita colagem já mascarada', () => {
    render(<ControlledDocument kind="cnpj" />);
    const input = screen.getByLabelText('Documento');

    fireEvent.change(input, { target: { value: '04.252.011/0001-11' } });
    expect(screen.getByRole('alert').textContent).toContain('CNPJ inválido');

    fireEvent.change(input, { target: { value: '04.252.011/0001-10' } });
    expect((input as HTMLInputElement).value).toBe('04.252.011/0001-10');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('BrazilianPhoneInput', () => {
  it('aplica máscara sem duplicá-la em celular e telefone fixo', () => {
    render(<ControlledPhone />);
    const input = screen.getByLabelText('Telefone');

    fireEvent.change(input, { target: { value: '(84) 99999-9999' } });
    expect((input as HTMLInputElement).value).toBe('(84) 99999-9999');

    fireEvent.change(input, { target: { value: '+55 (84) 99999-9999' } });
    expect((input as HTMLInputElement).value).toBe('(84) 99999-9999');

    fireEvent.change(input, { target: { value: '8433334444' } });
    expect((input as HTMLInputElement).value).toBe('(84) 3333-4444');
  });
});
