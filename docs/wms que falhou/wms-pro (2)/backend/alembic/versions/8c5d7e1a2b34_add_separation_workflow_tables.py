"""add separation workflow tables

Revision ID: 8c5d7e1a2b34
Revises: 4b2d6e8f9a13
Create Date: 2026-03-21 10:15:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8c5d7e1a2b34"
down_revision = "4b2d6e8f9a13"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "romaneio_separacao",
        sa.Column("codigo", sa.String(), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False, server_default="rascunho"),
        sa.Column("referencia_externa", sa.String(), nullable=True),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("prioridade", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("depot_id", sa.String(length=36), nullable=True),
        sa.Column("criado_por_id", sa.String(length=36), nullable=True),
        sa.Column("atualizado_por_id", sa.String(length=36), nullable=True),
        sa.Column("separador_responsavel_id", sa.String(length=36), nullable=True),
        sa.Column("conferencia_final_por_id", sa.String(length=36), nullable=True),
        sa.Column("rota_gerada_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("aguardando_separacao_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("iniciado_em_separacao_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("separacao_concluida_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("conferencia_final_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("saida_confirmada_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "status in ('rascunho', 'rota_gerada', 'aguardando_separacao', 'em_separacao', 'separacao_concluida', 'aguardando_conferencia_final', 'saida_confirmada', 'cancelado')",
            name="ck_romaneio_separacao_status_valid",
        ),
        sa.ForeignKeyConstraint(["atualizado_por_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["conferencia_final_por_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["criado_por_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["depot_id"], ["depots.id"]),
        sa.ForeignKeyConstraint(["separador_responsavel_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codigo", name="uq_romaneio_separacao_codigo"),
    )
    op.create_index("ix_romaneio_separacao_codigo", "romaneio_separacao", ["codigo"], unique=False)
    op.create_index("ix_romaneio_separacao_status", "romaneio_separacao", ["status"], unique=False)
    op.create_index("ix_romaneio_separacao_referencia_externa", "romaneio_separacao", ["referencia_externa"], unique=False)
    op.create_index("ix_romaneio_separacao_depot_id", "romaneio_separacao", ["depot_id"], unique=False)
    op.create_index("ix_romaneio_separacao_criado_por_id", "romaneio_separacao", ["criado_por_id"], unique=False)
    op.create_index("ix_romaneio_separacao_atualizado_por_id", "romaneio_separacao", ["atualizado_por_id"], unique=False)
    op.create_index("ix_romaneio_separacao_separador_responsavel_id", "romaneio_separacao", ["separador_responsavel_id"], unique=False)
    op.create_index("ix_romaneio_separacao_conferencia_final_por_id", "romaneio_separacao", ["conferencia_final_por_id"], unique=False)
    op.create_index("ix_romaneio_separacao_status_created", "romaneio_separacao", ["status", "created_at"], unique=False)
    op.create_index("ix_romaneio_separacao_depot_status", "romaneio_separacao", ["depot_id", "status"], unique=False)

    op.create_table(
        "itens_separacao",
        sa.Column("romaneio_id", sa.String(length=36), nullable=False),
        sa.Column("product_id", sa.String(length=36), nullable=False),
        sa.Column("stock_item_id", sa.String(length=36), nullable=True),
        sa.Column("drawer_id", sa.String(length=36), nullable=True),
        sa.Column("separador_id", sa.String(length=36), nullable=True),
        sa.Column("reservado_por_id", sa.String(length=36), nullable=True),
        sa.Column("ultima_atualizacao_por_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=64), nullable=False, server_default="pendente"),
        sa.Column("sequencia", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("codigo_lote", sa.String(), nullable=True),
        sa.Column("unidade_medida", sa.String(length=32), nullable=True),
        sa.Column("quantidade_solicitada", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quantidade_reservada", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quantidade_coletada", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("peso_solicitado", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("peso_reservado", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("peso_coletado", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("reservado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("coleta_iniciada_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("coletado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ultima_movimentacao_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "status in ('pendente', 'reservado', 'em_coleta', 'coletado', 'nao_achei', 'divergente')",
            name="ck_itens_separacao_status_valid",
        ),
        sa.CheckConstraint("peso_coletado >= 0", name="ck_itens_separacao_peso_coletado_non_negative"),
        sa.CheckConstraint("peso_reservado >= 0", name="ck_itens_separacao_peso_reservado_non_negative"),
        sa.CheckConstraint("peso_solicitado >= 0", name="ck_itens_separacao_peso_solicitado_non_negative"),
        sa.CheckConstraint("quantidade_coletada >= 0", name="ck_itens_separacao_qtd_coletada_non_negative"),
        sa.CheckConstraint("quantidade_reservada >= 0", name="ck_itens_separacao_qtd_reservada_non_negative"),
        sa.CheckConstraint("quantidade_solicitada >= 0", name="ck_itens_separacao_qtd_solicitada_non_negative"),
        sa.ForeignKeyConstraint(["drawer_id"], ["drawers.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["reservado_por_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["romaneio_id"], ["romaneio_separacao.id"]),
        sa.ForeignKeyConstraint(["separador_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["stock_item_id"], ["stock_items.id"]),
        sa.ForeignKeyConstraint(["ultima_atualizacao_por_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("romaneio_id", "sequencia", name="uq_itens_separacao_romaneio_sequencia"),
    )
    op.create_index("ix_itens_separacao_romaneio_id", "itens_separacao", ["romaneio_id"], unique=False)
    op.create_index("ix_itens_separacao_product_id", "itens_separacao", ["product_id"], unique=False)
    op.create_index("ix_itens_separacao_stock_item_id", "itens_separacao", ["stock_item_id"], unique=False)
    op.create_index("ix_itens_separacao_drawer_id", "itens_separacao", ["drawer_id"], unique=False)
    op.create_index("ix_itens_separacao_separador_id", "itens_separacao", ["separador_id"], unique=False)
    op.create_index("ix_itens_separacao_reservado_por_id", "itens_separacao", ["reservado_por_id"], unique=False)
    op.create_index("ix_itens_separacao_ultima_atualizacao_por_id", "itens_separacao", ["ultima_atualizacao_por_id"], unique=False)
    op.create_index("ix_itens_separacao_status", "itens_separacao", ["status"], unique=False)
    op.create_index("ix_itens_separacao_codigo_lote", "itens_separacao", ["codigo_lote"], unique=False)
    op.create_index("ix_itens_separacao_romaneio_status", "itens_separacao", ["romaneio_id", "status"], unique=False)
    op.create_index("ix_itens_separacao_produto_status", "itens_separacao", ["product_id", "status"], unique=False)

    op.create_table(
        "rotas_separacao",
        sa.Column("romaneio_id", sa.String(length=36), nullable=False),
        sa.Column("item_id", sa.String(length=36), nullable=True),
        sa.Column("depot_id", sa.String(length=36), nullable=True),
        sa.Column("shelf_id", sa.String(length=36), nullable=True),
        sa.Column("drawer_id", sa.String(length=36), nullable=True),
        sa.Column("stock_item_id", sa.String(length=36), nullable=True),
        sa.Column("gerada_por_id", sa.String(length=36), nullable=True),
        sa.Column("sequencia", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("ordem_coleta", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("drawer_key", sa.String(), nullable=True),
        sa.Column("corredor", sa.String(length=64), nullable=True),
        sa.Column("zona", sa.String(length=64), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("gerada_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["depot_id"], ["depots.id"]),
        sa.ForeignKeyConstraint(["drawer_id"], ["drawers.id"]),
        sa.ForeignKeyConstraint(["gerada_por_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["itens_separacao.id"]),
        sa.ForeignKeyConstraint(["romaneio_id"], ["romaneio_separacao.id"]),
        sa.ForeignKeyConstraint(["shelf_id"], ["shelves.id"]),
        sa.ForeignKeyConstraint(["stock_item_id"], ["stock_items.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("romaneio_id", "sequencia", name="uq_rotas_separacao_romaneio_sequencia"),
    )
    op.create_index("ix_rotas_separacao_romaneio_id", "rotas_separacao", ["romaneio_id"], unique=False)
    op.create_index("ix_rotas_separacao_item_id", "rotas_separacao", ["item_id"], unique=False)
    op.create_index("ix_rotas_separacao_depot_id", "rotas_separacao", ["depot_id"], unique=False)
    op.create_index("ix_rotas_separacao_shelf_id", "rotas_separacao", ["shelf_id"], unique=False)
    op.create_index("ix_rotas_separacao_drawer_id", "rotas_separacao", ["drawer_id"], unique=False)
    op.create_index("ix_rotas_separacao_stock_item_id", "rotas_separacao", ["stock_item_id"], unique=False)
    op.create_index("ix_rotas_separacao_gerada_por_id", "rotas_separacao", ["gerada_por_id"], unique=False)
    op.create_index("ix_rotas_separacao_drawer_key", "rotas_separacao", ["drawer_key"], unique=False)
    op.create_index("ix_rotas_separacao_corredor", "rotas_separacao", ["corredor"], unique=False)
    op.create_index("ix_rotas_separacao_zona", "rotas_separacao", ["zona"], unique=False)
    op.create_index("ix_rotas_separacao_gerada_at", "rotas_separacao", ["gerada_at"], unique=False)
    op.create_index("ix_rotas_separacao_romaneio_sequencia", "rotas_separacao", ["romaneio_id", "sequencia"], unique=False)
    op.create_index("ix_rotas_separacao_drawer", "rotas_separacao", ["drawer_id", "ordem_coleta"], unique=False)

    op.create_table(
        "tarefas_separador",
        sa.Column("romaneio_id", sa.String(length=36), nullable=False),
        sa.Column("item_id", sa.String(length=36), nullable=True),
        sa.Column("rota_id", sa.String(length=36), nullable=True),
        sa.Column("separador_id", sa.String(length=36), nullable=False),
        sa.Column("atribuida_por_id", sa.String(length=36), nullable=True),
        sa.Column("concluida_por_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pendente"),
        sa.Column("prioridade", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("titulo", sa.String(), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("atribuida_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("iniciada_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("concluida_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "status in ('pendente', 'em_andamento', 'concluida', 'cancelada')",
            name="ck_tarefas_separador_status_valid",
        ),
        sa.ForeignKeyConstraint(["atribuida_por_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["concluida_por_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["itens_separacao.id"]),
        sa.ForeignKeyConstraint(["romaneio_id"], ["romaneio_separacao.id"]),
        sa.ForeignKeyConstraint(["rota_id"], ["rotas_separacao.id"]),
        sa.ForeignKeyConstraint(["separador_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tarefas_separador_romaneio_id", "tarefas_separador", ["romaneio_id"], unique=False)
    op.create_index("ix_tarefas_separador_item_id", "tarefas_separador", ["item_id"], unique=False)
    op.create_index("ix_tarefas_separador_rota_id", "tarefas_separador", ["rota_id"], unique=False)
    op.create_index("ix_tarefas_separador_separador_id", "tarefas_separador", ["separador_id"], unique=False)
    op.create_index("ix_tarefas_separador_atribuida_por_id", "tarefas_separador", ["atribuida_por_id"], unique=False)
    op.create_index("ix_tarefas_separador_concluida_por_id", "tarefas_separador", ["concluida_por_id"], unique=False)
    op.create_index("ix_tarefas_separador_status", "tarefas_separador", ["status"], unique=False)
    op.create_index("ix_tarefas_separador_usuario_status", "tarefas_separador", ["separador_id", "status"], unique=False)
    op.create_index("ix_tarefas_separador_romaneio_status", "tarefas_separador", ["romaneio_id", "status"], unique=False)

    op.create_table(
        "divergencias_separacao",
        sa.Column("romaneio_id", sa.String(length=36), nullable=False),
        sa.Column("item_id", sa.String(length=36), nullable=True),
        sa.Column("product_id", sa.String(length=36), nullable=True),
        sa.Column("stock_item_id", sa.String(length=36), nullable=True),
        sa.Column("drawer_id", sa.String(length=36), nullable=True),
        sa.Column("reportado_por_id", sa.String(length=36), nullable=True),
        sa.Column("resolvido_por_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="aberta"),
        sa.Column("tipo", sa.String(length=64), nullable=False),
        sa.Column("severidade", sa.String(length=32), nullable=True),
        sa.Column("descricao", sa.Text(), nullable=False),
        sa.Column("quantidade_esperada", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("quantidade_encontrada", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("aberta_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("resolvida_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolucao", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "status in ('aberta', 'em_analise', 'resolvida', 'cancelada')",
            name="ck_divergencias_separacao_status_valid",
        ),
        sa.ForeignKeyConstraint(["drawer_id"], ["drawers.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["itens_separacao.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["reportado_por_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["resolvido_por_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["romaneio_id"], ["romaneio_separacao.id"]),
        sa.ForeignKeyConstraint(["stock_item_id"], ["stock_items.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_divergencias_separacao_romaneio_id", "divergencias_separacao", ["romaneio_id"], unique=False)
    op.create_index("ix_divergencias_separacao_item_id", "divergencias_separacao", ["item_id"], unique=False)
    op.create_index("ix_divergencias_separacao_product_id", "divergencias_separacao", ["product_id"], unique=False)
    op.create_index("ix_divergencias_separacao_stock_item_id", "divergencias_separacao", ["stock_item_id"], unique=False)
    op.create_index("ix_divergencias_separacao_drawer_id", "divergencias_separacao", ["drawer_id"], unique=False)
    op.create_index("ix_divergencias_separacao_reportado_por_id", "divergencias_separacao", ["reportado_por_id"], unique=False)
    op.create_index("ix_divergencias_separacao_resolvido_por_id", "divergencias_separacao", ["resolvido_por_id"], unique=False)
    op.create_index("ix_divergencias_separacao_status", "divergencias_separacao", ["status"], unique=False)
    op.create_index("ix_divergencias_separacao_tipo", "divergencias_separacao", ["tipo"], unique=False)
    op.create_index("ix_divergencias_separacao_severidade", "divergencias_separacao", ["severidade"], unique=False)
    op.create_index("ix_divergencias_separacao_aberta_at", "divergencias_separacao", ["aberta_at"], unique=False)
    op.create_index("ix_divergencias_separacao_resolvida_at", "divergencias_separacao", ["resolvida_at"], unique=False)
    op.create_index("ix_divergencias_separacao_status_created", "divergencias_separacao", ["status", "created_at"], unique=False)
    op.create_index("ix_divergencias_separacao_romaneio_status", "divergencias_separacao", ["romaneio_id", "status"], unique=False)

    op.create_table(
        "historico_separacao",
        sa.Column("romaneio_id", sa.String(length=36), nullable=False),
        sa.Column("item_id", sa.String(length=36), nullable=True),
        sa.Column("divergencia_id", sa.String(length=36), nullable=True),
        sa.Column("actor_user_id", sa.String(length=36), nullable=True),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=36), nullable=False),
        sa.Column("acao", sa.String(length=64), nullable=False),
        sa.Column("status_anterior", sa.String(length=64), nullable=True),
        sa.Column("status_novo", sa.String(length=64), nullable=True),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("payload_json", sa.JSON(), nullable=True),
        sa.Column("evento_em", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "entity_type in ('romaneio_separacao', 'itens_separacao', 'rotas_separacao', 'tarefas_separador', 'locks_separador', 'historico_separacao', 'divergencias_separacao')",
            name="ck_historico_separacao_entity_type_valid",
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["divergencia_id"], ["divergencias_separacao.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["itens_separacao.id"]),
        sa.ForeignKeyConstraint(["romaneio_id"], ["romaneio_separacao.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_historico_separacao_romaneio_id", "historico_separacao", ["romaneio_id"], unique=False)
    op.create_index("ix_historico_separacao_item_id", "historico_separacao", ["item_id"], unique=False)
    op.create_index("ix_historico_separacao_divergencia_id", "historico_separacao", ["divergencia_id"], unique=False)
    op.create_index("ix_historico_separacao_actor_user_id", "historico_separacao", ["actor_user_id"], unique=False)
    op.create_index("ix_historico_separacao_entity_type", "historico_separacao", ["entity_type"], unique=False)
    op.create_index("ix_historico_separacao_entity_id", "historico_separacao", ["entity_id"], unique=False)
    op.create_index("ix_historico_separacao_acao", "historico_separacao", ["acao"], unique=False)
    op.create_index("ix_historico_separacao_evento_em", "historico_separacao", ["evento_em"], unique=False)
    op.create_index("ix_historico_separacao_ip_address", "historico_separacao", ["ip_address"], unique=False)
    op.create_index("ix_historico_separacao_romaneio_evento", "historico_separacao", ["romaneio_id", "evento_em"], unique=False)
    op.create_index("ix_historico_separacao_entidade", "historico_separacao", ["entity_type", "entity_id"], unique=False)

    op.create_table(
        "locks_separador",
        sa.Column("romaneio_id", sa.String(length=36), nullable=True),
        sa.Column("item_id", sa.String(length=36), nullable=True),
        sa.Column("tarefa_id", sa.String(length=36), nullable=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("liberado_por_id", sa.String(length=36), nullable=True),
        sa.Column("lock_scope", sa.String(length=32), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=36), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=True),
        sa.Column("token", sa.String(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("adquirido_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("expira_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("liberado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "lock_scope in ('romaneio', 'item', 'rota', 'estoque', 'tarefa')",
            name="ck_locks_separador_scope_valid",
        ),
        sa.ForeignKeyConstraint(["item_id"], ["itens_separacao.id"]),
        sa.ForeignKeyConstraint(["liberado_por_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["romaneio_id"], ["romaneio_separacao.id"]),
        sa.ForeignKeyConstraint(["tarefa_id"], ["tarefas_separador.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index("ix_locks_separador_romaneio_id", "locks_separador", ["romaneio_id"], unique=False)
    op.create_index("ix_locks_separador_item_id", "locks_separador", ["item_id"], unique=False)
    op.create_index("ix_locks_separador_tarefa_id", "locks_separador", ["tarefa_id"], unique=False)
    op.create_index("ix_locks_separador_user_id", "locks_separador", ["user_id"], unique=False)
    op.create_index("ix_locks_separador_liberado_por_id", "locks_separador", ["liberado_por_id"], unique=False)
    op.create_index("ix_locks_separador_lock_scope", "locks_separador", ["lock_scope"], unique=False)
    op.create_index("ix_locks_separador_resource_type", "locks_separador", ["resource_type"], unique=False)
    op.create_index("ix_locks_separador_resource_id", "locks_separador", ["resource_id"], unique=False)
    op.create_index("ix_locks_separador_token", "locks_separador", ["token"], unique=True)
    op.create_index("ix_locks_separador_ativo", "locks_separador", ["ativo"], unique=False)
    op.create_index("ix_locks_separador_adquirido_at", "locks_separador", ["adquirido_at"], unique=False)
    op.create_index("ix_locks_separador_expira_at", "locks_separador", ["expira_at"], unique=False)
    op.create_index("ix_locks_separador_liberado_at", "locks_separador", ["liberado_at"], unique=False)
    op.create_index("ix_locks_separador_recurso_ativo", "locks_separador", ["resource_type", "resource_id", "ativo"], unique=False)
    op.create_index("ix_locks_separador_usuario_ativo", "locks_separador", ["user_id", "ativo"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_locks_separador_usuario_ativo", table_name="locks_separador")
    op.drop_index("ix_locks_separador_recurso_ativo", table_name="locks_separador")
    op.drop_index("ix_locks_separador_liberado_at", table_name="locks_separador")
    op.drop_index("ix_locks_separador_expira_at", table_name="locks_separador")
    op.drop_index("ix_locks_separador_adquirido_at", table_name="locks_separador")
    op.drop_index("ix_locks_separador_ativo", table_name="locks_separador")
    op.drop_index("ix_locks_separador_token", table_name="locks_separador")
    op.drop_index("ix_locks_separador_resource_id", table_name="locks_separador")
    op.drop_index("ix_locks_separador_resource_type", table_name="locks_separador")
    op.drop_index("ix_locks_separador_lock_scope", table_name="locks_separador")
    op.drop_index("ix_locks_separador_liberado_por_id", table_name="locks_separador")
    op.drop_index("ix_locks_separador_user_id", table_name="locks_separador")
    op.drop_index("ix_locks_separador_tarefa_id", table_name="locks_separador")
    op.drop_index("ix_locks_separador_item_id", table_name="locks_separador")
    op.drop_index("ix_locks_separador_romaneio_id", table_name="locks_separador")
    op.drop_table("locks_separador")

    op.drop_index("ix_historico_separacao_entidade", table_name="historico_separacao")
    op.drop_index("ix_historico_separacao_romaneio_evento", table_name="historico_separacao")
    op.drop_index("ix_historico_separacao_ip_address", table_name="historico_separacao")
    op.drop_index("ix_historico_separacao_evento_em", table_name="historico_separacao")
    op.drop_index("ix_historico_separacao_acao", table_name="historico_separacao")
    op.drop_index("ix_historico_separacao_entity_id", table_name="historico_separacao")
    op.drop_index("ix_historico_separacao_entity_type", table_name="historico_separacao")
    op.drop_index("ix_historico_separacao_actor_user_id", table_name="historico_separacao")
    op.drop_index("ix_historico_separacao_divergencia_id", table_name="historico_separacao")
    op.drop_index("ix_historico_separacao_item_id", table_name="historico_separacao")
    op.drop_index("ix_historico_separacao_romaneio_id", table_name="historico_separacao")
    op.drop_table("historico_separacao")

    op.drop_index("ix_divergencias_separacao_romaneio_status", table_name="divergencias_separacao")
    op.drop_index("ix_divergencias_separacao_status_created", table_name="divergencias_separacao")
    op.drop_index("ix_divergencias_separacao_resolvida_at", table_name="divergencias_separacao")
    op.drop_index("ix_divergencias_separacao_aberta_at", table_name="divergencias_separacao")
    op.drop_index("ix_divergencias_separacao_severidade", table_name="divergencias_separacao")
    op.drop_index("ix_divergencias_separacao_tipo", table_name="divergencias_separacao")
    op.drop_index("ix_divergencias_separacao_status", table_name="divergencias_separacao")
    op.drop_index("ix_divergencias_separacao_resolvido_por_id", table_name="divergencias_separacao")
    op.drop_index("ix_divergencias_separacao_reportado_por_id", table_name="divergencias_separacao")
    op.drop_index("ix_divergencias_separacao_drawer_id", table_name="divergencias_separacao")
    op.drop_index("ix_divergencias_separacao_stock_item_id", table_name="divergencias_separacao")
    op.drop_index("ix_divergencias_separacao_product_id", table_name="divergencias_separacao")
    op.drop_index("ix_divergencias_separacao_item_id", table_name="divergencias_separacao")
    op.drop_index("ix_divergencias_separacao_romaneio_id", table_name="divergencias_separacao")
    op.drop_table("divergencias_separacao")

    op.drop_index("ix_tarefas_separador_romaneio_status", table_name="tarefas_separador")
    op.drop_index("ix_tarefas_separador_usuario_status", table_name="tarefas_separador")
    op.drop_index("ix_tarefas_separador_status", table_name="tarefas_separador")
    op.drop_index("ix_tarefas_separador_concluida_por_id", table_name="tarefas_separador")
    op.drop_index("ix_tarefas_separador_atribuida_por_id", table_name="tarefas_separador")
    op.drop_index("ix_tarefas_separador_separador_id", table_name="tarefas_separador")
    op.drop_index("ix_tarefas_separador_rota_id", table_name="tarefas_separador")
    op.drop_index("ix_tarefas_separador_item_id", table_name="tarefas_separador")
    op.drop_index("ix_tarefas_separador_romaneio_id", table_name="tarefas_separador")
    op.drop_table("tarefas_separador")

    op.drop_index("ix_rotas_separacao_drawer", table_name="rotas_separacao")
    op.drop_index("ix_rotas_separacao_romaneio_sequencia", table_name="rotas_separacao")
    op.drop_index("ix_rotas_separacao_gerada_at", table_name="rotas_separacao")
    op.drop_index("ix_rotas_separacao_zona", table_name="rotas_separacao")
    op.drop_index("ix_rotas_separacao_corredor", table_name="rotas_separacao")
    op.drop_index("ix_rotas_separacao_drawer_key", table_name="rotas_separacao")
    op.drop_index("ix_rotas_separacao_gerada_por_id", table_name="rotas_separacao")
    op.drop_index("ix_rotas_separacao_stock_item_id", table_name="rotas_separacao")
    op.drop_index("ix_rotas_separacao_drawer_id", table_name="rotas_separacao")
    op.drop_index("ix_rotas_separacao_shelf_id", table_name="rotas_separacao")
    op.drop_index("ix_rotas_separacao_depot_id", table_name="rotas_separacao")
    op.drop_index("ix_rotas_separacao_item_id", table_name="rotas_separacao")
    op.drop_index("ix_rotas_separacao_romaneio_id", table_name="rotas_separacao")
    op.drop_table("rotas_separacao")

    op.drop_index("ix_itens_separacao_produto_status", table_name="itens_separacao")
    op.drop_index("ix_itens_separacao_romaneio_status", table_name="itens_separacao")
    op.drop_index("ix_itens_separacao_codigo_lote", table_name="itens_separacao")
    op.drop_index("ix_itens_separacao_status", table_name="itens_separacao")
    op.drop_index("ix_itens_separacao_ultima_atualizacao_por_id", table_name="itens_separacao")
    op.drop_index("ix_itens_separacao_reservado_por_id", table_name="itens_separacao")
    op.drop_index("ix_itens_separacao_separador_id", table_name="itens_separacao")
    op.drop_index("ix_itens_separacao_drawer_id", table_name="itens_separacao")
    op.drop_index("ix_itens_separacao_stock_item_id", table_name="itens_separacao")
    op.drop_index("ix_itens_separacao_product_id", table_name="itens_separacao")
    op.drop_index("ix_itens_separacao_romaneio_id", table_name="itens_separacao")
    op.drop_table("itens_separacao")

    op.drop_index("ix_romaneio_separacao_depot_status", table_name="romaneio_separacao")
    op.drop_index("ix_romaneio_separacao_status_created", table_name="romaneio_separacao")
    op.drop_index("ix_romaneio_separacao_conferencia_final_por_id", table_name="romaneio_separacao")
    op.drop_index("ix_romaneio_separacao_separador_responsavel_id", table_name="romaneio_separacao")
    op.drop_index("ix_romaneio_separacao_atualizado_por_id", table_name="romaneio_separacao")
    op.drop_index("ix_romaneio_separacao_criado_por_id", table_name="romaneio_separacao")
    op.drop_index("ix_romaneio_separacao_depot_id", table_name="romaneio_separacao")
    op.drop_index("ix_romaneio_separacao_referencia_externa", table_name="romaneio_separacao")
    op.drop_index("ix_romaneio_separacao_status", table_name="romaneio_separacao")
    op.drop_index("ix_romaneio_separacao_codigo", table_name="romaneio_separacao")
    op.drop_table("romaneio_separacao")
