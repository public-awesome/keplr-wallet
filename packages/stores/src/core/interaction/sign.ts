import { InteractionStore } from "./interaction";
import { computed, makeObservable } from "mobx";
import { SignDocWrapper } from "@keplr-wallet/cosmos";
import { KeplrSignOptions, StdSignDoc } from "@keplr-wallet/types";
import { InteractionWaitingData, PlainObject } from "@keplr-wallet/background";

export type SignInteractionData =
  | {
      origin: string;
      chainId: string;
      mode: "amino";
      signer: string;
      signDoc: StdSignDoc;
      signOptions: KeplrSignOptions & {
        isADR36WithString?: boolean;
      };
      keyType: string;
      keyInsensitive: PlainObject;

      eip712?: {
        types: Record<string, { name: string; type: string }[] | undefined>;
        domain: Record<string, any>;
        primaryType: string;
      };
    }
  | {
      origin: string;
      chainId: string;
      mode: "direct";
      signer: string;
      signDocBytes: Uint8Array;
      signOptions: KeplrSignOptions;
      keyType: string;
      keyInsensitive: PlainObject;
    };

export class SignInteractionStore {
  constructor(protected readonly interactionStore: InteractionStore) {
    makeObservable(this);
  }

  get waitingDatas() {
    return this.interactionStore.getAllData<SignInteractionData>(
      "request-sign-cosmos"
    );
  }

  @computed
  get waitingData():
    | InteractionWaitingData<
        SignInteractionData & { signDocWrapper: SignDocWrapper }
      >
    | undefined {
    const datas = this.waitingDatas;

    if (datas.length === 0) {
      return undefined;
    }

    const data = datas[0];
    const wrapper =
      data.data.mode === "amino"
        ? SignDocWrapper.fromAminoSignDoc(data.data.signDoc)
        : SignDocWrapper.fromDirectSignDocBytes(data.data.signDocBytes);

    return {
      id: data.id,
      type: data.type,
      isInternal: data.isInternal,
      data: {
        ...data.data,
        signDocWrapper: wrapper,
      },
    };
  }

  async approveWithProceedNext(
    id: string,
    newSignDocWrapper: SignDocWrapper,
    signature: Uint8Array | undefined,
    afterFn: (proceedNext: boolean) => void | Promise<void>,
    options: {
      preDelay?: number;
    } = {}
  ) {
    const res = (() => {
      if (newSignDocWrapper.mode === "amino") {
        return {
          newSignDoc: newSignDocWrapper.aminoSignDoc,
        };
      }
      return {
        newSignDocBytes: newSignDocWrapper.protoSignDoc.toBytes(),
      };
    })();

    await this.interactionStore.approveWithProceedNextV2(
      id,
      {
        ...res,
        signature,
      },
      afterFn,
      options
    );
  }

  async rejectWithProceedNext(
    id: string,
    afterFn: (proceedNext: boolean) => void | Promise<void>
  ) {
    await this.interactionStore.rejectWithProceedNext(id, afterFn);
  }

  async rejectAll() {
    await this.interactionStore.rejectAll("request-sign-cosmos");
  }

  isObsoleteInteraction(id: string | undefined): boolean {
    return this.interactionStore.isObsoleteInteraction(id);
  }
}
