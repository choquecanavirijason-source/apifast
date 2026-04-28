import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import DroppableColumn from "../components/DroppableColumn";
import DraggableTicketCard from "../components/DraggableTicketCard";
import { SectionCard } from "../../../components/common/ui";

export default function QueueBoard({
  waitingTickets,
  inServiceTickets,
  completedTickets,
  iaTickets,
  professionals,
  editingTicketId,
  handleStartService,
  handleMarkCompleted,
  handleOpenFinishModal,
  handleSaveTicketEdits,
  handleDeleteClick,
  handleDragEnd,
  isRecentlyCreated,
  statusColors,
  getRemainingLabel,
}) {
  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  return (
    <SectionCard className="mt-5">
      <DndContext sensors={dndSensors} onDragEnd={handleDragEnd}>
        <div className="space-y-5">
          <div className="grid gap-5 xl:gap-6 lg:grid-cols-2 xl:grid-cols-4 items-start">
            <DroppableColumn
              id="ia"
              title={`Tickets con IA (${iaTickets.length})`}
              subtitle="Todos los tickets generados por IA se agrupan aqui."
              tickets={iaTickets}
              isEmptyLabel="No hay tickets con IA para los filtros actuales."
              highlightTicket={isRecentlyCreated}
              renderCard={(ticket) => (
                <DraggableTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  professionals={professionals}
                  onSaveEdits={handleSaveTicketEdits}
                  isSavingEdit={editingTicketId === ticket.id}
                  actions={null}
                  showRemaining={ticket.status === "in_service"}
                  statusColors={statusColors}
                  getRemainingLabel={getRemainingLabel}
                  onDelete={handleDeleteClick}
                />
              )}
            />
            <DroppableColumn
              id="waiting"
              title="En espera"
              subtitle="Tickets pendientes del dia"
              tickets={waitingTickets}
              isEmptyLabel="Sin clientas en espera."
              highlightTicket={isRecentlyCreated}
              renderCard={(ticket) => (
                <DraggableTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  professionals={professionals}
                  onSaveEdits={handleSaveTicketEdits}
                  isSavingEdit={editingTicketId === ticket.id}
                  actions={null}
                  showRemaining={false}
                  statusColors={statusColors}
                  getRemainingLabel={getRemainingLabel}
                  onDelete={handleDeleteClick}
                />
              )}
            />
            <DroppableColumn
              id="in_service"
              title="En servicio"
              subtitle="Atenciones en curso"
              tickets={inServiceTickets}
              isEmptyLabel="Sin servicios activos."
              highlightTicket={isRecentlyCreated}
              renderCard={(ticket) => (
                <DraggableTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  professionals={professionals}
                  onSaveEdits={handleSaveTicketEdits}
                  isSavingEdit={editingTicketId === ticket.id}
                  actions={null}
                  showRemaining
                  statusColors={statusColors}
                  getRemainingLabel={getRemainingLabel}
                  onDelete={handleDeleteClick}
                />
              )}
            />
            <DroppableColumn
              id="completed"
              title="Finalizadas"
              subtitle="Atenciones completadas"
              tickets={completedTickets}
              isEmptyLabel="Sin finalizadas hoy."
              highlightTicket={isRecentlyCreated}
              renderCard={(ticket) => (
                <DraggableTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  professionals={professionals}
                  onSaveEdits={handleSaveTicketEdits}
                  isSavingEdit={editingTicketId === ticket.id}
                  actions={null}
                  showRemaining={false}
                  statusColors={statusColors}
                  getRemainingLabel={getRemainingLabel}
                  onDelete={handleDeleteClick}
                />
              )}
            />
          </div>
        </div>
      </DndContext>
    </SectionCard>
  );
}
