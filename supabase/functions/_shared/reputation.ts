type ServiceClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: Array<{ applied: boolean; event_id: string | null; reputation: number }> | null; error: { message: string } | null }>;
};

export type ReputationEventInput = {
  eventKey: string;
  userId: string;
  amount: number;
  reason: string;
  sourceResource: string;
  sourceId: string | null;
  actorId: string | null;
};

export type ReputationEventResult = {
  applied: boolean;
  eventId: string | null;
  reputation: number;
};

export async function recordReputationEvent(
  client: ServiceClient,
  input: ReputationEventInput,
): Promise<ReputationEventResult> {
  const { data, error } = await client.rpc("apply_reputation_event", {
    p_event_key: input.eventKey,
    p_user_id: input.userId,
    p_amount: input.amount,
    p_reason: input.reason,
    p_source_resource: input.sourceResource,
    p_source_id: input.sourceId,
    p_actor_id: input.actorId,
  });

  if (error || !data?.[0]) {
    throw new Error("Unable to record reputation event");
  }

  return {
    applied: data[0].applied,
    eventId: data[0].event_id,
    reputation: data[0].reputation,
  };
}
