import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Select,
  SelectItem,
  Textarea,
} from '@heroui/react';
import { Account, RifAssistenza } from '../../services/api';
import { AssistenzaRegistrazione } from '../../types/assistenzaRegistrazione';
import TimerWidget from './TimerWidget';

interface FormSectionProps {
  isCreate: boolean;
  assistenza?: AssistenzaRegistrazione;
  accountsList?: Account[];
  tipologie: string[];
  filteredRifAssistenze: RifAssistenza[];
  clienteId: string;
  tipologia: string;
  rifAssistenzaId: string;
  data: string;
  oreIntervento: string;
  ore: string;
  totale: string;
  attne: string;
  descrizione: string;
  materiale: string;
  errors: Record<string, string>;
  timerDisplay: string;
  timerRunning: boolean;
  timerSeconds: number;
  setClienteId: (value: string) => void;
  setTipologia: (value: string) => void;
  setRifAssistenzaId: (value: string) => void;
  setData: (value: string) => void;
  setOreIntervento: (value: string) => void;
  setOre: (value: string) => void;
  setTotale: (value: string) => void;
  setAttne: (value: string) => void;
  setDescrizione: (value: string) => void;
  setMateriale: (value: string) => void;
  onBack: () => void;
  onSave: () => void;
  onRifAssistenzaSelected: (selected: string) => void;
  onTimerStart: () => void;
  onTimerPause: () => void;
  onTimerApply: () => void;
  onTimerReset: () => void;
  isPending: boolean;
}

export default function FormSection({
  isCreate,
  assistenza,
  accountsList,
  tipologie,
  filteredRifAssistenze,
  clienteId,
  tipologia,
  rifAssistenzaId,
  data,
  oreIntervento,
  ore,
  totale,
  attne,
  descrizione,
  materiale,
  errors,
  timerDisplay,
  timerRunning,
  timerSeconds,
  setClienteId,
  setTipologia,
  setRifAssistenzaId,
  setData,
  setOreIntervento,
  setOre,
  setTotale,
  setAttne,
  setDescrizione,
  setMateriale,
  onBack,
  onSave,
  onRifAssistenzaSelected,
  onTimerStart,
  onTimerPause,
  onTimerApply,
  onTimerReset,
  isPending,
}: FormSectionProps) {
  const a = assistenza;

  return (
    <>
      {!isCreate && a && (
        <Card shadow="sm" className="bg-[#e8f4f8] border border-[#168AAD]/20">
          <CardBody className="gap-2 p-4">
            <p className="text-xs font-semibold text-[#1A759F] uppercase tracking-wider">Informazioni</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-default-400 text-xs">NR</span>
                <p className="font-medium">{a.nr}</p>
              </div>
              <div>
                <span className="text-default-400 text-xs">Data</span>
                <p>{a.data ? new Date(a.data).toLocaleDateString('it-IT') : '—'}</p>
              </div>
              <div>
                <span className="text-default-400 text-xs">Rif. Assistenza</span>
                <p>{a.rifAssistenzaNome || '—'}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Card shadow="sm" className="bg-[#e8f4f8] border border-[#168AAD]/20 overflow-hidden">
        <CardBody className="gap-2.5 p-3">
          <p className="text-xs font-semibold text-[#1A759F] uppercase tracking-wider">Assegnazione</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Select
              label="Cliente"
              placeholder="Seleziona cliente..."
              variant="bordered"
              selectedKeys={clienteId ? [clienteId] : []}
              onSelectionChange={(keys) => setClienteId((Array.from(keys)[0] as string | undefined) ?? '')}
              className="sm:col-span-2"
              classNames={{ trigger: 'bg-white' }}
            >
              {(accountsList ?? []).map((acc) => (
                <SelectItem key={acc.accountid}>{acc.name}</SelectItem>
              ))}
            </Select>

            <Select
              label="Tipologia"
              placeholder="Seleziona tipologia..."
              variant="bordered"
              selectedKeys={tipologia ? [tipologia] : []}
              onSelectionChange={(keys) => {
                const selected = (Array.from(keys)[0] as string | undefined) ?? '';
                setTipologia(selected);
                setRifAssistenzaId('');
              }}
              className="sm:col-span-2"
              classNames={{ trigger: 'bg-white' }}
            >
              {tipologie.map((t) => (
                <SelectItem key={t}>{t}</SelectItem>
              ))}
            </Select>

            <Select
              label="Rif. Assistenza"
              placeholder={tipologia ? 'Seleziona assistenza...' : 'Seleziona prima la tipologia...'}
              variant="bordered"
              selectedKeys={rifAssistenzaId ? [rifAssistenzaId] : []}
              isDisabled={!tipologia}
              isInvalid={!!errors.rifAssistenzaId}
              errorMessage={errors.rifAssistenzaId}
              onSelectionChange={(keys) => {
                const selected = (Array.from(keys)[0] as string | undefined) ?? '';
                setRifAssistenzaId(selected);
                onRifAssistenzaSelected(selected);
              }}
              className="sm:col-span-2"
              classNames={{ trigger: 'bg-white' }}
            >
              {filteredRifAssistenze.map((rif) => (
                <SelectItem key={rif.phyo_assistenzeid}>{rif.phyo_nrassistenze}</SelectItem>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card shadow="sm" className="bg-white">
        <CardBody className="gap-2.5 p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-semibold text-[#184E77] uppercase tracking-wider">Dettagli registrazione</p>
            {!isCreate && a && (
              <div className="flex items-center gap-2 flex-wrap">
                <Chip size="sm" variant="flat" color="primary">{a.statoReg}</Chip>
                <Chip size="sm" variant="dot" color={a.statoRegistrazione === 'Aperta' ? 'primary' : 'default'}>
                  {a.statoRegistrazione}
                </Chip>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Data"
              value={data}
              onValueChange={setData}
              variant="bordered"
              type="date"
              isInvalid={!!errors.data}
              errorMessage={errors.data}
            />

            <div className="flex items-end gap-1.5">
              <Input
                label="Ore Intervento"
                placeholder="00:00:00"
                value={oreIntervento}
                onValueChange={setOreIntervento}
                variant="bordered"
                type="time"
                className="flex-1 min-w-0"
                size="sm"
                step={1}
                isInvalid={!!errors.oreIntervento}
                errorMessage={errors.oreIntervento}
              />
              <TimerWidget
                timerDisplay={timerDisplay}
                timerRunning={timerRunning}
                timerSeconds={timerSeconds}
                onStart={onTimerStart}
                onPause={onTimerPause}
                onApply={onTimerApply}
                onReset={onTimerReset}
              />
            </div>

            <Input
              label="Ore"
              placeholder="0,00"
              value={ore}
              onValueChange={setOre}
              variant="bordered"
              type="text"
              inputMode="decimal"
              isInvalid={!!errors.ore}
              errorMessage={errors.ore}
            />

            <Input
              label="Totale"
              placeholder="Inserisci totale..."
              value={totale}
              onValueChange={setTotale}
              variant="bordered"
              type="text"
              inputMode="decimal"
              isInvalid={!!errors.totale}
              errorMessage={errors.totale}
            />
          </div>

          <Input
            label="Att.ne"
            placeholder="Inserisci att.ne..."
            value={attne}
            onValueChange={setAttne}
            variant="bordered"
          />

          <Textarea
            label="Descrizione Intervento"
            placeholder="Descrivi l'intervento eseguito..."
            value={descrizione}
            onValueChange={setDescrizione}
            variant="bordered"
            minRows={2}
          />

          <Textarea
            label="Materiale Utilizzato"
            placeholder="Elenca il materiale utilizzato..."
            value={materiale}
            onValueChange={setMateriale}
            variant="bordered"
            minRows={2}
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="flat" className="text-[#184E77]" onPress={onBack}>
              Annulla
            </Button>
            <Button color="primary" onPress={onSave} isLoading={isPending} className="font-semibold bg-[#1A759F]">
              {isCreate ? 'Crea' : 'Salva'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
