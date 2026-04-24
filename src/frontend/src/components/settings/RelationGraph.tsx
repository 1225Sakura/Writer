import {
	useEffect,
	useRef,
	useState,
	useMemo,
	useCallback,
	Suspense,
	lazy,
} from "react";
import { useSettingsStore } from "@/store";
import {
	LinkIcon,
	Filter,
	Box,
	Grid2x2,
	ZoomIn,
	ZoomOut,
	RotateCcw,
	Eye,
	EyeOff,
	X,
	Users,
	MapPin,
	Swords,
	BookOpen,
	Globe,
	Scroll,
	ChevronRight,
	Maximize2,
	Minimize2,
	Sparkles,
	Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ForceGraph2D = lazy(() => import("react-force-graph-2d"));
const ForceGraph3D = lazy(() => import("react-force-graph-3d"));

interface GraphNode {
	id: string;
	name: string;
	type: EntityNodeType;
	color: string;
	val: number;
	description?: string;
	entityId: number;
}

interface GraphLink {
	source: string;
	target: string;
	type: string;
	color: string;
}

type EntityNodeType =
	| "character"
	| "item"
	| "location"
	| "faction"
	| "world"
	| "rule"
	| "outline"
	| "ifline";

interface NodeDetail {
	node: GraphNode;
	x: number;
	y: number;
}

interface HoverTooltipState {
	node: GraphNode;
	x: number;
	y: number;
}

// Enhanced entity type config with glow variants and ring colors
const ENTITY_TYPE_CONFIG: Record<
	EntityNodeType,
	{
		label: string;
		color: string;
		icon: typeof Users;
		glowColor: string;
		glowStrong: string;
		ringColor: string;
		size: number;
	}
> = {
	character: {
		label: "角色",
		color: "#e8b87d",
		icon: Users,
		glowColor: "rgba(232, 184, 125, 0.5)",
		glowStrong: "rgba(232, 184, 125, 0.8)",
		ringColor: "rgba(232, 184, 125, 0.25)",
		size: 8,
	},
	item: {
		label: "物品",
		color: "#9b7ed9",
		icon: Scroll,
		glowColor: "rgba(155, 126, 217, 0.5)",
		glowStrong: "rgba(155, 126, 217, 0.8)",
		ringColor: "rgba(155, 126, 217, 0.25)",
		size: 6,
	},
	location: {
		label: "地点",
		color: "#5eb5a6",
		icon: MapPin,
		glowColor: "rgba(94, 181, 166, 0.5)",
		glowStrong: "rgba(94, 181, 166, 0.8)",
		ringColor: "rgba(94, 181, 166, 0.25)",
		size: 7,
	},
	faction: {
		label: "势力",
		color: "#d45d5d",
		icon: Swords,
		glowColor: "rgba(212, 93, 93, 0.5)",
		glowStrong: "rgba(212, 93, 93, 0.8)",
		ringColor: "rgba(212, 93, 93, 0.25)",
		size: 7,
	},
	world: {
		label: "世界观",
		color: "#5e6ad2",
		icon: Globe,
		glowColor: "rgba(94, 106, 210, 0.5)",
		glowStrong: "rgba(94, 106, 210, 0.8)",
		ringColor: "rgba(94, 106, 210, 0.25)",
		size: 6,
	},
	rule: {
		label: "规则",
		color: "#c8aa6e",
		icon: BookOpen,
		glowColor: "rgba(200, 170, 110, 0.5)",
		glowStrong: "rgba(200, 170, 110, 0.8)",
		ringColor: "rgba(200, 170, 110, 0.25)",
		size: 5,
	},
	outline: {
		label: "大纲",
		color: "#5b8ee8",
		icon: BookOpen,
		glowColor: "rgba(91, 142, 232, 0.5)",
		glowStrong: "rgba(91, 142, 232, 0.8)",
		ringColor: "rgba(91, 142, 232, 0.25)",
		size: 5,
	},
	ifline: {
		label: "IF线",
		color: "#7eb84a",
		icon: Scroll,
		glowColor: "rgba(126, 184, 74, 0.5)",
		glowStrong: "rgba(126, 184, 74, 0.8)",
		ringColor: "rgba(126, 184, 74, 0.25)",
		size: 6,
	},
};

const RELATION_TYPE_COLORS: Record<string, string> = {
	family: "#5eb5a6",
	friend: "#5b8ee8",
	enemy: "#c45c5c",
	master: "#9b7ed9",
	disciple: "#c8aa6e",
	rival: "#e8b87d",
	romantic: "#d45d5d",
	owns: "#9b7ed9",
	located_at: "#5eb5a6",
	belongs_to: "#d45d5d",
	other: "#6b7280",
};

const RELATION_TYPE_LABELS: Record<string, string> = {
	family: "家人",
	friend: "朋友",
	enemy: "敌人",
	master: "师父",
	disciple: "徒弟",
	rival: "竞争",
	romantic: "恋人",
	owns: "拥有",
	located_at: "位于",
	belongs_to: "属于",
	other: "其他",
};

const PERFORMANCE_THRESHOLD = 100;

function useGraphData() {
	const {
		characters,
		items,
		locations,
		factions,
		worldSettings,
		rules,
		ifLines,
	} = useSettingsStore();

	return useMemo(() => {
		const nodes: GraphNode[] = [];
		const links: GraphLink[] = [];

		characters.forEach((char) => {
			nodes.push({
				id: `char_${char.id}`,
				name: char.name,
				type: "character",
				color: ENTITY_TYPE_CONFIG.character.color,
				val: Math.max(char.relationships.length + 1, 1),
				description: char.description || char.personality || "",
				entityId: char.id,
			});

			char.relationships.forEach((rel) => {
				const targetId = `char_${rel.targetId}`;
				if (nodes.some((n) => n.id === targetId)) {
					links.push({
						source: `char_${char.id}`,
						target: targetId,
						type: rel.type,
						color: RELATION_TYPE_COLORS[rel.type] || RELATION_TYPE_COLORS.other,
					});
				}
			});
		});

		items.forEach((item) => {
			nodes.push({
				id: `item_${item.id}`,
				name: item.name,
				type: "item",
				color: ENTITY_TYPE_CONFIG.item.color,
				val: 1,
				description: item.description || "",
				entityId: item.id,
			});
			if (item.owner) {
				const ownerChar = characters.find((c) => c.name === item.owner);
				if (ownerChar) {
					links.push({
						source: `char_${ownerChar.id}`,
						target: `item_${item.id}`,
						type: "owns",
						color: RELATION_TYPE_COLORS.owns,
					});
				}
			}
			if (item.location) {
				const loc = locations.find((l) => l.name === item.location);
				if (loc) {
					links.push({
						source: `item_${item.id}`,
						target: `loc_${loc.id}`,
						type: "located_at",
						color: RELATION_TYPE_COLORS.located_at,
					});
				}
			}
		});

		locations.forEach((loc) => {
			nodes.push({
				id: `loc_${loc.id}`,
				name: loc.name,
				type: "location",
				color: ENTITY_TYPE_CONFIG.location.color,
				val: 1,
				description: loc.description || "",
				entityId: loc.id,
			});
		});

		factions.forEach((fac) => {
			nodes.push({
				id: `fac_${fac.id}`,
				name: fac.name,
				type: "faction",
				color: ENTITY_TYPE_CONFIG.faction.color,
				val: 1,
				description: fac.description || "",
				entityId: fac.id,
			});
		});

		worldSettings.forEach((ws) => {
			nodes.push({
				id: `world_${ws.id}`,
				name: ws.name,
				type: "world",
				color: ENTITY_TYPE_CONFIG.world.color,
				val: 1,
				description: ws.description || "",
				entityId: ws.id,
			});
		});

		rules.forEach((rule) => {
			nodes.push({
				id: `rule_${rule.id}`,
				name: rule.name,
				type: "rule",
				color: ENTITY_TYPE_CONFIG.rule.color,
				val: 1,
				description: rule.description || "",
				entityId: rule.id,
			});
		});

		ifLines.forEach((ifl) => {
			nodes.push({
				id: `ifl_${ifl.id}`,
				name: ifl.title,
				type: "ifline",
				color: ENTITY_TYPE_CONFIG.ifline.color,
				val: 1,
				description: ifl.description || "",
				entityId: ifl.id,
			});
			if (ifl.linked_character_id) {
				links.push({
					source: `char_${ifl.linked_character_id}`,
					target: `ifl_${ifl.id}`,
					type: "other",
					color: RELATION_TYPE_COLORS.other,
				});
			}
		});

		return { nodes, links };
	}, [characters, items, locations, factions, worldSettings, rules, ifLines]);
}

function GraphFallback() {
	return (
		<div className="h-full flex items-center justify-center bg-[var(--color-surface-base)] relative overflow-hidden">
			<div className="absolute inset-0 opacity-30">
				<div
					className="absolute inset-0"
					style={{
						backgroundImage:
							"radial-gradient(circle, var(--border-subtle) 1px, transparent 1px)",
						backgroundSize: "24px 24px",
					}}
				/>
			</div>
			<div className="text-center relative z-10">
				<div className="relative mx-auto mb-4 w-10 h-10">
					<div className="absolute inset-0 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
					<div
						className="absolute inset-1 rounded-full border-2 border-[var(--accent-primary)] border-b-transparent animate-spin"
						style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
					/>
					<Sparkles className="w-4 h-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--accent-primary)]" />
				</div>
				<p className="text-xs text-[var(--text-tertiary)] font-medium">
					加载图谱引擎...
				</p>
				<p className="text-[10px] text-[var(--text-disabled)] mt-1">
					正在构建节点关系
				</p>
			</div>
		</div>
	);
}

// Node hover tooltip with rich info following cursor
function NodeHoverTooltip({
	tooltip,
	containerRef,
}: {
	tooltip: HoverTooltipState;
	containerRef: React.RefObject<HTMLDivElement | null>;
}) {
	const config = ENTITY_TYPE_CONFIG[tooltip.node.type];
	const Icon = config.icon;

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.92 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.92 }}
			transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
			className="absolute z-30 rounded-xl p-3 min-w-[180px] max-w-[240px] pointer-events-none"
			style={{
				left: Math.min(
					tooltip.x + 16,
					(containerRef.current?.clientWidth || 800) - 260,
				),
				top: Math.max(tooltip.y - 12, 8),
				background:
					"linear-gradient(145deg, rgba(22, 24, 28, 0.98), rgba(15, 16, 20, 0.98))",
				border: `1px solid ${config.color}30`,
				boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02), 0 0 30px ${config.glowColor}25`,
				backdropFilter: "blur(20px)",
			}}
		>
			<div
				className="absolute top-0 left-3 right-3 h-px rounded-full"
				style={{
					background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
				}}
			/>
			<div className="flex items-center gap-2 mb-2">
				<div
					className="w-7 h-7 rounded-lg flex items-center justify-center"
					style={{
						background: `linear-gradient(135deg, ${config.color}20, ${config.color}08)`,
						boxShadow: `0 0 10px ${config.glowColor}30`,
					}}
				>
					<Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
				</div>
				<div className="min-w-0">
					<p className="text-sm font-semibold text-[var(--text-primary)] truncate">
						{tooltip.node.name}
					</p>
					<p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
						{config.label}
					</p>
				</div>
			</div>
			{tooltip.node.description && (
				<p className="text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-2 mb-2">
					{tooltip.node.description}
				</p>
			)}
			<div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
				<span className="flex items-center gap-1">
					<LinkIcon className="w-3 h-3" style={{ color: config.color }} />
					{tooltip.node.val - 1} 条关系
				</span>
				<span className="flex items-center gap-1">
					<Info className="w-3 h-3" style={{ color: config.color }} />
					ID: {tooltip.node.entityId}
				</span>
			</div>
		</motion.div>
	);
}

function NodeDetailPanel({
	detail,
	onClose,
}: {
	detail: NodeDetail;
	onClose: () => void;
}) {
	const config = ENTITY_TYPE_CONFIG[detail.node.type];
	const Icon = config.icon;

	return (
		<motion.div
			initial={{ opacity: 0, y: 8, scale: 0.96 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: 8, scale: 0.96 }}
			transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
			className="absolute z-20 rounded-xl p-3.5 min-w-[200px] max-w-[260px]"
			style={{
				left: Math.min(
					detail.x + 16,
					(typeof window !== "undefined" ? window.innerWidth : 800) - 280,
				),
				top: Math.max(detail.y - 16, 8),
				background:
					"linear-gradient(145deg, rgba(22, 24, 28, 0.98), rgba(15, 16, 20, 0.98))",
				border: "1px solid rgba(255, 255, 255, 0.08)",
				boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02), 0 0 30px ${config.glowColor}20`,
				backdropFilter: "blur(20px)",
			}}
		>
			<div
				className="absolute top-0 left-4 right-4 h-px rounded-full"
				style={{
					background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
				}}
			/>
			<div className="flex items-start justify-between mb-2.5">
				<div className="flex items-center gap-2.5">
					<div
						className="w-8 h-8 rounded-xl flex items-center justify-center relative"
						style={{
							background: `linear-gradient(135deg, ${config.color}20, ${config.color}08)`,
							boxShadow: `0 0 12px ${config.glowColor}30, inset 0 1px 0 rgba(255,255,255,0.05)`,
						}}
					>
						<Icon className="w-4 h-4" style={{ color: config.color }} />
					</div>
					<div>
						<p className="text-sm font-semibold text-[var(--text-primary)]">
							{detail.node.name}
						</p>
						<p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
							{config.label}
						</p>
					</div>
				</div>
				<button
					onClick={onClose}
					className="p-1 rounded-lg hover:bg-white/10 transition-all duration-200 flex-shrink-0 group"
				>
					<X className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
				</button>
			</div>
			{detail.node.description && (
				<p className="text-xs line-clamp-3 mb-2.5 text-[var(--text-secondary)] leading-relaxed">
					{detail.node.description}
				</p>
			)}
			<div className="flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)] pt-2 border-t border-white/5">
				<LinkIcon className="w-3 h-3" style={{ color: config.color }} />
				<span>{detail.node.val - 1} 条关系</span>
			</div>
		</motion.div>
	);
}

function FilterControls({
	activeTypes,
	onToggleType,
	filterRelation,
	onSetRelationFilter,
	onZoomIn,
	onZoomOut,
	onResetView,
}: {
	activeTypes: Set<EntityNodeType>;
	onToggleType: (type: EntityNodeType) => void;
	filterRelation: string;
	onSetRelationFilter: (type: string) => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onResetView: () => void;
}) {
	const [isExpanded, setIsExpanded] = useState(false);

	const relationTypes = Object.entries(RELATION_TYPE_LABELS);

	return (
		<div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
			<div
				className="flex flex-col gap-0.5 rounded-xl p-1.5"
				style={{
					background:
						"linear-gradient(145deg, rgba(30, 32, 38, 0.95), rgba(22, 24, 28, 0.95))",
					border: "1px solid rgba(255, 255, 255, 0.08)",
					boxShadow:
						"0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.02)",
				}}
			>
				<FilterButton icon={ZoomIn} title="放大 (滚轮上)" onClick={onZoomIn} />
				<FilterButton
					icon={ZoomOut}
					title="缩小 (滚轮下)"
					onClick={onZoomOut}
				/>
				<FilterButton icon={RotateCcw} title="重置视图" onClick={onResetView} />
			</div>

			<div
				className="rounded-xl p-1.5"
				style={{
					background:
						"linear-gradient(145deg, rgba(30, 32, 38, 0.95), rgba(22, 24, 28, 0.95))",
					border: "1px solid rgba(255, 255, 255, 0.06)",
					boxShadow:
						"0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.02)",
				}}
			>
				<button
					onClick={() => setIsExpanded(!isExpanded)}
					className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all duration-200 w-full group"
				>
					<Filter className="w-3 h-3 text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors" />
					<span className="text-[10px] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors font-medium">
						筛选
					</span>
					<ChevronRight
						className="w-3 h-3 ml-auto transition-transform text-[var(--text-tertiary)]"
						style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
					/>
				</button>

				<AnimatePresence>
					{isExpanded && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
							className="overflow-hidden"
						>
							<div className="pt-2 space-y-0.5">
								{(
									Object.entries(ENTITY_TYPE_CONFIG) as [
										EntityNodeType,
										(typeof ENTITY_TYPE_CONFIG)["character"],
									][]
								).map(([type, config]) => {
									const isActive = activeTypes.has(type);
									return (
										<button
											key={type}
											onClick={() => onToggleType(type)}
											className="flex items-center gap-2 px-2 py-1.5 rounded-lg w-full transition-all duration-200"
											style={{
												backgroundColor: isActive
													? `${config.color}18`
													: "transparent",
											}}
											onMouseEnter={(e) => {
												if (!isActive)
													e.currentTarget.style.backgroundColor =
														"rgba(255,255,255,0.04)";
											}}
											onMouseLeave={(e) => {
												if (!isActive)
													e.currentTarget.style.backgroundColor = "transparent";
											}}
										>
											<div
												className="w-2.5 h-2.5 rounded-full transition-all duration-200"
												style={{
													backgroundColor: isActive
														? config.color
														: "var(--text-disabled)",
													opacity: isActive ? 1 : 0.3,
													boxShadow: isActive
														? `0 0 6px ${config.glowColor}`
														: "none",
												}}
											/>
											<span
												className="text-[10px] transition-colors duration-200"
												style={{
													color: isActive
														? config.color
														: "var(--text-tertiary)",
												}}
											>
												{config.label}
											</span>
										</button>
									);
								})}
							</div>

							<div className="pt-2 mt-2 border-t border-white/5">
								<p className="text-[10px] mb-1.5 px-2 text-[var(--text-tertiary)] font-medium">
									关系类型
								</p>
								<select
									value={filterRelation}
									onChange={(e) => onSetRelationFilter(e.target.value)}
									className="w-full text-[10px] px-2 py-1.5 rounded-lg border-none outline-none cursor-pointer text-[var(--text-tertiary)] transition-colors"
									style={{
										background: "rgba(255,255,255,0.04)",
									}}
								>
									<option value="all">全部关系</option>
									{relationTypes.map(([type, label]) => (
										<option key={type} value={type}>
											{label}
										</option>
									))}
								</select>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

function FilterButton({
	icon: Icon,
	title,
	onClick,
}: {
	icon: typeof ZoomIn;
	title: string;
	onClick: () => void;
}) {
	return (
		<button
			className="p-2 rounded-lg hover:bg-white/10 transition-all duration-200 group flex items-center justify-center"
			title={title}
			onClick={onClick}
		>
			<Icon className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors" />
		</button>
	);
}

function Legend({
	showLegend,
	onToggle,
	visibleRelationTypes,
}: {
	showLegend: boolean;
	onToggle: () => void;
	visibleRelationTypes: string[];
}) {
	if (!showLegend) {
		return (
			<button
				onClick={onToggle}
				className="absolute bottom-3 right-3 z-10 p-2.5 rounded-xl transition-all duration-200 group"
				title="显示图例"
				style={{
					background:
						"linear-gradient(145deg, rgba(30, 32, 38, 0.95), rgba(22, 24, 28, 0.95))",
					border: "1px solid rgba(255, 255, 255, 0.06)",
					boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
				}}
			>
				<Eye className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors" />
			</button>
		);
	}

	const uniqueTypes = [...new Set(visibleRelationTypes)];

	return (
		<motion.div
			initial={{ opacity: 0, y: 8, scale: 0.96 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
			className="absolute bottom-3 right-3 z-10 rounded-xl overflow-hidden"
			style={{
				minWidth: "160px",
				background:
					"linear-gradient(145deg, rgba(22, 24, 28, 0.97), rgba(15, 16, 20, 0.97))",
				border: "1px solid rgba(255, 255, 255, 0.08)",
				boxShadow:
					"0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)",
				backdropFilter: "blur(20px)",
			}}
		>
			<div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
				<span className="text-[10px] font-semibold text-[rgba(255,255,255,0.5)] uppercase tracking-wider">
					图例
				</span>
				<button
					onClick={onToggle}
					className="p-1 rounded-lg hover:bg-white/10 transition-all duration-200"
				>
					<EyeOff className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
				</button>
			</div>

			<div className="p-3">
				<div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
					{(
						Object.entries(ENTITY_TYPE_CONFIG) as [
							EntityNodeType,
							(typeof ENTITY_TYPE_CONFIG)["character"],
						][]
					).map(([type, config]) => (
						<div key={type} className="flex items-center gap-2">
							<div
								className="w-3 h-3 rounded-full flex-shrink-0"
								style={{
									backgroundColor: config.color,
									boxShadow: `0 0 8px ${config.glowColor}`,
								}}
							/>
							<span className="text-[10px] text-[var(--text-secondary)]">
								{config.label}
							</span>
						</div>
					))}
				</div>

				{uniqueTypes.length > 0 && (
					<>
						<div className="border-t border-white/5 pt-2.5">
							<span className="text-[9px] text-[var(--text-disabled)] font-medium uppercase tracking-wider mb-2 block">
								关系类型
							</span>
							<div className="space-y-1.5">
								{uniqueTypes.slice(0, 6).map((type) => (
									<div key={type} className="flex items-center gap-2.5">
										<div
											className="w-5 h-[2px] rounded-full flex-shrink-0"
											style={{
												backgroundColor:
													RELATION_TYPE_COLORS[type] ||
													RELATION_TYPE_COLORS.other,
												boxShadow: `0 0 6px ${RELATION_TYPE_COLORS[type] || RELATION_TYPE_COLORS.other}50`,
											}}
										/>
										<span className="text-[10px] text-[var(--text-secondary)]">
											{RELATION_TYPE_LABELS[type] || type}
										</span>
									</div>
								))}
								{uniqueTypes.length > 6 && (
									<span className="text-[9px] text-[var(--text-disabled)]">
										+{uniqueTypes.length - 6} 更多
									</span>
								)}
							</div>
						</div>
					</>
				)}
			</div>
		</motion.div>
	);
}

function StatsBar({
	nodeCount,
	linkCount,
	filterRelation,
	onClearFilter,
}: {
	nodeCount: number;
	linkCount: number;
	filterRelation: string;
	onClearFilter: () => void;
}) {
	return (
		<div
			className="absolute bottom-3 left-3 z-10 text-[10px] px-3 py-2 rounded-xl flex items-center gap-2.5"
			style={{
				background:
					"linear-gradient(145deg, rgba(22, 24, 28, 0.95), rgba(15, 16, 20, 0.95))",
				border: "1px solid rgba(255, 255, 255, 0.06)",
				boxShadow:
					"0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.02)",
				backdropFilter: "blur(16px)",
			}}
		>
			<span className="text-[var(--text-secondary)] font-medium">
				{nodeCount} 节点
			</span>
			<span className="text-[var(--text-disabled)]">·</span>
			<span className="text-[var(--text-secondary)] font-medium">
				{linkCount} 关系
			</span>
			{filterRelation !== "all" && (
				<>
					<span className="text-[var(--text-disabled)]">·</span>
					<button
						className="underline hover:text-[var(--accent-primary)] transition-colors duration-200"
						onClick={onClearFilter}
					>
						清除筛选
					</button>
				</>
			)}
		</div>
	);
}

function GraphBackground() {
	return (
		<div className="absolute inset-0 pointer-events-none overflow-hidden">
			<div
				className="absolute inset-0 opacity-[0.08]"
				style={{
					backgroundImage:
						"radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
					backgroundSize: "32px 32px",
				}}
			/>
			<div
				className="absolute inset-0"
				style={{
					background:
						"radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.12) 100%)",
				}}
			/>
			<div
				className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] opacity-[0.04]"
				style={{
					background:
						"radial-gradient(ellipse at center, var(--accent-100) 0%, transparent 70%)",
				}}
			/>
		</div>
	);
}

export function RelationGraph() {
	const containerRef = useRef<HTMLDivElement>(null);
	const fgRef = useRef<any>(null);
	const { characters } = useSettingsStore();
	const [isGenerating, setIsGenerating] = useState(false);

	const [dimensions, setDimensions] = useState({ width: 300, height: 400 });
	const [viewport, setViewport] = useState({
		x: 0,
		y: 0,
		width: 300,
		height: 400,
	});
	const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
	const [activeNodeTypes, setActiveNodeTypes] = useState<Set<EntityNodeType>>(
		new Set(Object.keys(ENTITY_TYPE_CONFIG) as EntityNodeType[]),
	);
	const [filterRelation, setFilterRelation] = useState<string>("all");
	const [showLegend, setShowLegend] = useState(true);
	const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
	const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState | null>(
		null,
	);
	const [isFullscreen, setIsFullscreen] = useState(false);

	const { nodes: allNodes, links: allLinks } = useGraphData();

	const { nodes, links } = useMemo(() => {
		const filteredNodes = allNodes.filter((n) => activeNodeTypes.has(n.type));
		const nodeIds = new Set(filteredNodes.map((n) => n.id));
		let filteredLinks = allLinks.filter(
			(l) => nodeIds.has(l.source) && nodeIds.has(l.target),
		);
		if (filterRelation !== "all") {
			filteredLinks = filteredLinks.filter((l) => l.type === filterRelation);
		}
		return { nodes: filteredNodes, links: filteredLinks };
	}, [allNodes, allLinks, activeNodeTypes, filterRelation]);

	const visibleNodes = useMemo(() => {
		const buffer = 100;
		return nodes.filter((node) => {
			const nx = (node as any).x || 0;
			const ny = (node as any).y || 0;
			return (
				nx >= viewport.x - buffer &&
				nx <= viewport.x + viewport.width + buffer &&
				ny >= viewport.y - buffer &&
				ny <= viewport.y + viewport.height + buffer
			);
		});
	}, [nodes, viewport]);

	const visibleLinks = useMemo(() => {
		const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
		return links.filter(
			(link) =>
				visibleNodeIds.has(link.source as string) &&
				visibleNodeIds.has(link.target as string),
		);
	}, [links, visibleNodes]);

	const renderMode = useMemo(() => {
		if (nodes.length > PERFORMANCE_THRESHOLD * 1.5) return "simple";
		if (nodes.length > PERFORMANCE_THRESHOLD) return "optimized";
		return "full";
	}, [nodes.length]);

	useEffect(() => {
		const updateDimensions = () => {
			if (containerRef.current) {
				const { width, height } = containerRef.current.getBoundingClientRect();
				setDimensions({ width, height });
				setViewport((prev) => ({ ...prev, width, height }));
			}
		};
		updateDimensions();
		const observer = new ResizeObserver(updateDimensions);
		if (containerRef.current) observer.observe(containerRef.current);
		window.addEventListener("resize", updateDimensions);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updateDimensions);
		};
	}, []);

	const updateViewport = useCallback(
		(centerZoom: { k: number; x: number; y: number }) => {
			const newViewport = {
				x: -centerZoom.x / centerZoom.k,
				y: -centerZoom.y / centerZoom.k,
				width: dimensions.width / centerZoom.k,
				height: dimensions.height / centerZoom.k,
			};
			setViewport(newViewport);
		},
		[dimensions],
	);

	const toggleNodeType = useCallback((type: EntityNodeType) => {
		setActiveNodeTypes((prev) => {
			const next = new Set(prev);
			if (next.has(type)) {
				if (next.size > 1) next.delete(type);
			} else {
				next.add(type);
			}
			return next;
		});
	}, []);

	const handleNodeClick = useCallback((node: any, event: MouseEvent) => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		setSelectedNode({
			node: node as GraphNode,
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		});
	}, []);

	const handleBackgroundClick = useCallback(() => {
		setSelectedNode(null);
	}, []);

	const toggleFullscreen = useCallback(() => {
		setIsFullscreen((prev) => !prev);
		setTimeout(() => {
			if (fgRef.current) {
				fgRef.current.zoomToFit(400, 40);
			}
		}, 100);
	}, []);

	const handleGenerateRelations = useCallback(() => {
		setIsGenerating(true);
		setTimeout(() => {
			setIsGenerating(false);
		}, 2000);
	}, []);

	// Track node position for hover tooltip during drag
	const handleNodeDrag = useCallback((node: any) => {
		if (!node) return;
		setHoverTooltip({
			node: node as GraphNode,
			x: (node.x as number) || 0,
			y: (node.y as number) || 0,
		});
	}, []);

	// Custom node canvas renderer with enhanced visuals
	const nodeCanvasObject = useCallback(
		(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
			const config = ENTITY_TYPE_CONFIG[node.type as EntityNodeType];
			const isHovered = node.id === hoveredNodeId;
			const isSelected = selectedNode?.node.id === node.id;
			const baseSize = config?.size || 6;
			const baseRadius = Math.sqrt(node.val) * baseSize + baseSize;
			const radius = baseRadius * (isHovered ? 1.3 : 1);

			const x = node.x as number;
			const y = node.y as number;

			// Pulsing animation for hovered nodes
			const pulseScale = isHovered ? 1 + Math.sin(Date.now() / 200) * 0.08 : 1;
			const finalRadius = radius * pulseScale;

			// Multi-layer glow effect with stronger outer glow
			if (isHovered || isSelected) {
				for (let i = 4; i > 0; i--) {
					const glowRadius = finalRadius + i * 7;
					const glowGradient = ctx.createRadialGradient(
						x,
						y,
						finalRadius,
						x,
						y,
						glowRadius,
					);
					glowGradient.addColorStop(
						0,
						config?.glowStrong || "rgba(94, 106, 210, 0.3)",
					);
					glowGradient.addColorStop(1, "transparent");
					ctx.fillStyle = glowGradient;
					ctx.beginPath();
					ctx.arc(x, y, glowRadius, 0, 2 * Math.PI);
					ctx.fill();
				}
			}

			// Orbit ring animation for hovered nodes
			if (isHovered && renderMode === "full") {
				const time = Date.now() / 1500;
				const ringRadius = finalRadius + 12;
				ctx.beginPath();
				ctx.arc(x, y, ringRadius, time, time + Math.PI * 1.5);
				ctx.strokeStyle = config?.ringColor || "rgba(94, 106, 210, 0.3)";
				ctx.lineWidth = 1.5;
				ctx.setLineDash([4, 4]);
				ctx.stroke();
				ctx.setLineDash([]);
			}

			// Outer ring shadow
			ctx.shadowColor = isHovered
				? config?.color || "#5e6ad2"
				: "rgba(0,0,0,0.4)";
			ctx.shadowBlur = isHovered ? 20 : 6;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = isHovered ? 0 : 3;

			// Main node circle with gradient
			const nodeGradient = ctx.createRadialGradient(
				x - finalRadius * 0.35,
				y - finalRadius * 0.35,
				0,
				x,
				y,
				finalRadius,
			);
			nodeGradient.addColorStop(0, config?.color || "#5e6ad2");
			nodeGradient.addColorStop(0.7, `${config?.color || "#5e6ad2"}dd`);
			nodeGradient.addColorStop(1, `${config?.color || "#5e6ad2"}99`);

			ctx.beginPath();
			ctx.arc(x, y, finalRadius, 0, 2 * Math.PI);
			ctx.fillStyle = nodeGradient;
			ctx.fill();

			// Reset shadow
			ctx.shadowBlur = 0;
			ctx.shadowOffsetY = 0;

			// Inner highlight (top-left)
			const highlightGradient = ctx.createRadialGradient(
				x - finalRadius * 0.3,
				y - finalRadius * 0.3,
				0,
				x,
				y,
				finalRadius * 0.7,
			);
			highlightGradient.addColorStop(0, "rgba(255,255,255,0.35)");
			highlightGradient.addColorStop(0.5, "rgba(255,255,255,0.08)");
			highlightGradient.addColorStop(1, "transparent");
			ctx.beginPath();
			ctx.arc(x, y, finalRadius * 0.7, 0, 2 * Math.PI);
			ctx.fillStyle = highlightGradient;
			ctx.fill();

			// Animated border ring
			const borderWidth = isHovered ? 2.5 : isSelected ? 2 : 1;
			const borderOpacity = isHovered ? 0.7 : isSelected ? 0.5 : 0.2;
			ctx.beginPath();
			ctx.arc(x, y, finalRadius + 2, 0, 2 * Math.PI);
			ctx.strokeStyle = isHovered
				? `rgba(255,255,255,${borderOpacity})`
				: isSelected
					? `${config?.color || "#5e6ad2"}80`
					: "rgba(255,255,255,0.15)";
			ctx.lineWidth = borderWidth;
			ctx.stroke();

			// Connection ring for nodes with many relationships
			if (node.val > 3) {
				ctx.beginPath();
				ctx.arc(x, y, finalRadius + 5, 0, 2 * Math.PI);
				ctx.strokeStyle = `${config?.color || "#5e6ad2"}30`;
				ctx.lineWidth = 1;
				ctx.setLineDash([3, 3]);
				ctx.stroke();
				ctx.setLineDash([]);
			}

			// Node label
			const label = node.name;
			const fontSize = Math.max(11 / globalScale, 9);
			ctx.font = `${isHovered ? "600" : "500"} ${fontSize}px Inter, system-ui, sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";

			const yOffset = finalRadius + fontSize * 1.2;

			const displayLabel = label.length > 8 ? label.slice(0, 8) + ".." : label;
			const textMetrics = ctx.measureText(displayLabel);
			const textWidth = textMetrics.width;
			const padding = 5;

			// Label shadow for better readability
			ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
			ctx.beginPath();
			ctx.roundRect(
				x - textWidth / 2 - padding,
				y + yOffset - fontSize / 2 - padding / 2 + 1,
				textWidth + padding * 2,
				fontSize + padding,
				4,
			);
			ctx.fill();

			ctx.fillStyle = "rgba(15, 16, 20, 0.85)";
			ctx.beginPath();
			ctx.roundRect(
				x - textWidth / 2 - padding,
				y + yOffset - fontSize / 2 - padding / 2,
				textWidth + padding * 2,
				fontSize + padding,
				4,
			);
			ctx.fill();

			// Label text
			ctx.fillStyle = isHovered ? "#ffffff" : "rgba(255,255,255,0.75)";
			ctx.fillText(displayLabel, x, y + yOffset);

			// Type indicator dot for hovered nodes
			if (isHovered) {
				const dotX = x - textWidth / 2 - 10;
				const dotY = y + yOffset;
				ctx.beginPath();
				ctx.arc(dotX, dotY, 4, 0, 2 * Math.PI);
				ctx.fillStyle = config?.color || node.color;
				ctx.shadowColor = config?.color || node.color;
				ctx.shadowBlur = 8;
				ctx.fill();
				ctx.shadowBlur = 0;
			}
		},
		[hoveredNodeId, selectedNode, renderMode],
	);

	// Custom link renderer with gradient and animated flow
	const linkCanvasObject = useCallback(
		(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
			const isHighlighted =
				hoveredNodeId &&
				(link.source.id === hoveredNodeId || link.target.id === hoveredNodeId);
			const isDimmed = hoveredNodeId && !isHighlighted;

			if (isDimmed && renderMode === "simple") return;

			const start = link.source;
			const end = link.target;
			const sx = start.x as number;
			const sy = start.y as number;
			const ex = end.x as number;
			const ey = end.y as number;

			// Calculate control point for curved lines
			const midX = (sx + ex) / 2;
			const midY = (sy + ey) / 2;
			const dx = ex - sx;
			const dy = ey - sy;
			const dist = Math.sqrt(dx * dx + dy * dy);
			const curvature = Math.min(dist * 0.15, 35);
			const perpX = (-dy / dist) * curvature;
			const perpY = (dx / dist) * curvature;
			const cx = midX + perpX;
			const cy = midY + perpY;

			const opacity = isDimmed ? 0.05 : isHighlighted ? 1 : 0.45;
			const lineWidth = isHighlighted ? 3 : isDimmed ? 0.5 : 1.5;

			const color = link.color || "#6b7280";

			const parseColor = (c: string, a: number) => {
				if (c.startsWith("#")) {
					const r = parseInt(c.slice(1, 3), 16);
					const g = parseInt(c.slice(3, 5), 16);
					const b = parseInt(c.slice(5, 7), 16);
					return `rgba(${r},${g},${b},${a})`;
				}
				return c;
			};

			// Create gradient along the curved line
			const gradient = ctx.createLinearGradient(sx, sy, ex, ey);
			gradient.addColorStop(0, parseColor(color, opacity * 0.2));
			gradient.addColorStop(0.3, parseColor(color, opacity * 0.7));
			gradient.addColorStop(0.7, parseColor(color, opacity));
			gradient.addColorStop(1, parseColor(color, opacity * 0.2));

			ctx.strokeStyle = gradient;
			ctx.globalAlpha = 1;
			ctx.lineWidth = lineWidth / globalScale;
			ctx.lineCap = "round";

			// Draw main curved path with shadow
			if (isHighlighted) {
				ctx.shadowColor = color;
				ctx.shadowBlur = 8;
			}

			ctx.beginPath();
			ctx.moveTo(sx, sy);
			ctx.quadraticCurveTo(cx, cy, ex, ey);
			ctx.stroke();

			ctx.shadowBlur = 0;

			// Animated flowing particles for highlighted links
			if (isHighlighted && renderMode === "full") {
				const time = Date.now() / 1000;
				const particleCount = 3;

				for (let i = 0; i < particleCount; i++) {
					const t = (time * 0.5 + i / particleCount) % 1;
					const px = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex;
					const py = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey;
					const particleSize = 3 - t * 2;

					ctx.beginPath();
					ctx.arc(px, py, particleSize, 0, 2 * Math.PI);
					ctx.fillStyle = parseColor(color, (1 - t) * 0.8);
					ctx.shadowColor = color;
					ctx.shadowBlur = 6;
					ctx.fill();
				}
				ctx.shadowBlur = 0;
			}

			// Arrow head for directional relations
			if (isHighlighted && renderMode !== "simple") {
				const angle = Math.atan2(ey - cy, ex - cx);
				const arrowSize = 6 / globalScale;
				const arrowX = ex - Math.cos(angle) * (curvature * 0.3 + 5);
				const arrowY = ey - Math.sin(angle) * (curvature * 0.3 + 5);

				ctx.beginPath();
				ctx.moveTo(arrowX, arrowY);
				ctx.lineTo(
					arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
					arrowY - arrowSize * Math.sin(angle - Math.PI / 6),
				);
				ctx.lineTo(
					arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
					arrowY - arrowSize * Math.sin(angle + Math.PI / 6),
				);
				ctx.closePath();
				ctx.fillStyle = parseColor(color, opacity * 0.8);
				ctx.fill();
			}
		},
		[hoveredNodeId, renderMode],
	);

	if (characters.length === 0 && allNodes.length === 0) {
		return (
			<div className="h-full flex items-center justify-center text-center p-4 bg-[var(--color-surface-base)] relative overflow-hidden">
				<GraphBackground />
				<motion.div
					className="relative z-10"
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
				>
					<motion.div
						className="relative mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center"
						style={{
							background:
								"linear-gradient(135deg, rgba(94, 106, 210, 0.08), rgba(94, 106, 210, 0.03))",
							border: "1px solid rgba(94, 106, 210, 0.12)",
							boxShadow: "0 0 24px rgba(94, 106, 210, 0.06)",
						}}
						initial={{ scale: 0.9 }}
						animate={{ scale: 1 }}
						transition={{ type: "spring", stiffness: 400, damping: 25 }}
					>
						<LinkIcon className="w-6 h-6 text-[var(--accent-primary)] opacity-50" />
					</motion.div>
					<p className="text-sm mb-1 text-[var(--text-secondary)] font-medium">
						添加角色后
					</p>
					<p className="text-xs text-[var(--text-tertiary)]">
						这里将显示关系图谱
					</p>
				</motion.div>
			</div>
		);
	}

	if (nodes.length === 0) {
		return (
			<div className="h-full flex items-center justify-center text-center p-4 bg-[var(--color-surface-base)] relative overflow-hidden">
				<GraphBackground />
				<motion.div
					className="relative z-10"
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
				>
					<motion.div
						className="relative mx-auto mb-4 w-14 h-14 rounded-xl flex items-center justify-center"
						style={{
							background:
								"linear-gradient(135deg, rgba(94, 106, 210, 0.1), rgba(94, 106, 210, 0.05))",
							border: "1px solid rgba(94, 106, 210, 0.15)",
						}}
						initial={{ scale: 0.9 }}
						animate={{ scale: 1 }}
						transition={{ type: "spring", stiffness: 400, damping: 25 }}
					>
						<Filter className="w-5 h-5 text-[var(--accent-primary)]" />
					</motion.div>
					<p className="text-sm mb-1 text-[var(--text-secondary)] font-medium">
						筛选条件过于严格
					</p>
					<p className="text-xs text-[var(--text-tertiary)]">
						没有符合条件的节点
					</p>
				</motion.div>
			</div>
		);
	}

	const visibleRelationTypes = [...new Set(visibleLinks.map((l) => l.type))];

	return (
		<div
			ref={containerRef}
			className={`relative overflow-hidden bg-[var(--color-surface-base)] ${isFullscreen ? "fixed inset-0 z-50" : "h-full"}`}
		>
			<GraphBackground />

			{/* Top accent line */}
			<div
				className="absolute top-0 left-0 right-0 h-px z-10"
				style={{
					background:
						"linear-gradient(90deg, transparent, rgba(94, 106, 210, 0.4), rgba(94, 106, 210, 0.15), rgba(94, 106, 210, 0.4), transparent)",
				}}
			/>

			{/* Generate Relations Button */}
			<div className="absolute top-3 right-20 z-10">
				<motion.button
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
					onClick={handleGenerateRelations}
					disabled={isGenerating}
					className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-medium transition-all duration-300 disabled:opacity-70"
					style={{
						background: isGenerating
							? "linear-gradient(135deg, rgba(94, 106, 210, 0.15), rgba(94, 106, 210, 0.08))"
							: "linear-gradient(135deg, rgba(94, 106, 210, 0.2), rgba(94, 106, 210, 0.1))",
						border: "1px solid rgba(94, 106, 210, 0.25)",
						boxShadow: isGenerating
							? "0 0 20px rgba(94, 106, 210, 0.1), inset 0 1px 0 rgba(255,255,255,0.05)"
							: "0 4px 16px rgba(94, 106, 210, 0.15), 0 0 0 1px rgba(94, 106, 210, 0.1), inset 0 1px 0 rgba(255,255,255,0.08)",
						color: "var(--accent-primary)",
					}}
				>
					{isGenerating ? (
						<>
							<div className="w-3 h-3 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
							<span>生成中...</span>
						</>
					) : (
						<>
							<Sparkles className="w-3.5 h-3.5" />
							<span>生成关系</span>
						</>
					)}
				</motion.button>
			</div>

			{/* View mode toggle */}
			<div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
				<button
					onClick={toggleFullscreen}
					className="p-2 rounded-xl transition-all duration-200 group"
					title={isFullscreen ? "退出全屏" : "全屏"}
					style={{
						background:
							"linear-gradient(145deg, rgba(30, 32, 38, 0.95), rgba(22, 24, 28, 0.95))",
						border: "1px solid rgba(255, 255, 255, 0.06)",
						boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
					}}
				>
					{isFullscreen ? (
						<Minimize2 className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors" />
					) : (
						<Maximize2 className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors" />
					)}
				</button>
				<button
					onClick={() => setViewMode(viewMode === "2d" ? "3d" : "2d")}
					className="p-2 rounded-xl transition-all duration-200 flex items-center gap-1.5 group"
					title={viewMode === "2d" ? "切换到3D视图" : "切换到2D视图"}
					style={{
						background:
							"linear-gradient(145deg, rgba(30, 32, 38, 0.95), rgba(22, 24, 28, 0.95))",
						border: "1px solid rgba(255, 255, 255, 0.06)",
						boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
					}}
				>
					{viewMode === "2d" ? (
						<Box className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors" />
					) : (
						<Grid2x2 className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors" />
					)}
					<span className="text-[10px] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors font-medium">
						{viewMode.toUpperCase()}
					</span>
				</button>
			</div>

			{/* Filter controls with zoom */}
			<FilterControls
				activeTypes={activeNodeTypes}
				onToggleType={toggleNodeType}
				filterRelation={filterRelation}
				onSetRelationFilter={setFilterRelation}
				onZoomIn={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.3, 300)}
				onZoomOut={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.3, 300)}
				onResetView={() => fgRef.current?.zoomToFit(400, 40)}
			/>

			{/* Force Graph */}
			<Suspense fallback={<GraphFallback />}>
				{viewMode === "2d" ? (
					<ForceGraph2D
						ref={fgRef}
						graphData={{ nodes: visibleNodes, links: visibleLinks }}
						width={dimensions.width}
						height={dimensions.height}
						backgroundColor="transparent"
						nodeLabel="name"
						nodeColor={(node: any) => node.color}
						nodeVal={(node: any) => Math.sqrt(node.val) * 6 + 4}
						nodeRelSize={6}
						linkColor={(link: any) => link.color}
						linkWidth={(link: any) => {
							const isHighlighted =
								hoveredNodeId &&
								(link.source.id === hoveredNodeId ||
									link.target.id === hoveredNodeId);
							return isHighlighted ? 2.5 : 1;
						}}
						{...{
							linkOpacity: (link: any) => {
								if (renderMode === "simple") return 0.2;
								const isHighlighted =
									hoveredNodeId &&
									(link.source.id === hoveredNodeId ||
										link.target.id === hoveredNodeId);
								const isDimmed = hoveredNodeId && !isHighlighted;
								return isDimmed ? 0.08 : isHighlighted ? 0.9 : 0.35;
							},
						}}
						linkDirectionalParticles={renderMode === "full" ? 2 : 0}
						linkDirectionalParticleSpeed={renderMode === "full" ? 0.008 : 0}
						linkDirectionalParticleWidth={(link: any) => {
							const isHighlighted =
								renderMode !== "simple" &&
								hoveredNodeId &&
								(link.source.id === hoveredNodeId ||
									link.target.id === hoveredNodeId);
							return isHighlighted ? 2 : 0;
						}}
						onNodeClick={handleNodeClick}
						onBackgroundClick={handleBackgroundClick}
						onNodeHover={
							renderMode !== "simple"
								? (node: any) => {
										setHoveredNodeId(node?.id || null);
										if (!node) setHoverTooltip(null);
									}
								: undefined
						}
						onNodeDrag={renderMode !== "simple" ? handleNodeDrag : undefined}
						onEngineStop={() => {
							if (fgRef.current) {
								const centerGraph = fgRef.current.centerAt();
								const zoom = fgRef.current.zoom();
								updateViewport({
									k: zoom,
									x: centerGraph.x || 0,
									y: centerGraph.y || 0,
								});
							}
						}}
						cooldownTicks={
							renderMode === "simple"
								? 30
								: renderMode === "optimized"
									? 60
									: 100
						}
						warmupTicks={
							renderMode === "simple" ? 5 : renderMode === "optimized" ? 10 : 20
						}
						d3AlphaDecay={renderMode === "simple" ? 0.05 : 0.02}
						d3VelocityDecay={renderMode === "simple" ? 0.5 : 0.3}
						enableNodeDrag={true}
						enableZoomInteraction={true}
						enablePanInteraction={true}
						nodeCanvasObjectMode={() => "replace"}
						nodeCanvasObject={
							renderMode === "simple" ? undefined : nodeCanvasObject
						}
						linkCanvasObjectMode={() => "replace"}
						linkCanvasObject={
							renderMode === "simple" ? undefined : linkCanvasObject
						}
					/>
				) : (
					<ForceGraph3D
						ref={fgRef}
						graphData={{ nodes: visibleNodes, links: visibleLinks }}
						width={dimensions.width}
						height={dimensions.height}
						backgroundColor="transparent"
						nodeLabel="name"
						nodeColor={(node: any) => node.color}
						nodeVal={(node: any) => Math.sqrt(node.val) * 4 + 3}
						linkColor={(link: any) => link.color}
						linkWidth={0.5}
						linkOpacity={0.4}
						onNodeClick={handleNodeClick}
						onBackgroundClick={handleBackgroundClick}
						enableNodeDrag={true}
						enableNavigationControls={true}
						showNavInfo={false}
						cooldownTicks={100}
						warmupTicks={20}
					/>
				)}
			</Suspense>

			{/* Node hover tooltip */}
			<AnimatePresence>
				{hoverTooltip && !selectedNode && (
					<NodeHoverTooltip
						tooltip={hoverTooltip}
						containerRef={containerRef}
					/>
				)}
			</AnimatePresence>

			{/* Node detail panel (click) */}
			<AnimatePresence>
				{selectedNode && (
					<NodeDetailPanel
						detail={selectedNode}
						onClose={() => setSelectedNode(null)}
					/>
				)}
			</AnimatePresence>

			{/* Stats bar */}
			<StatsBar
				nodeCount={visibleNodes.length}
				linkCount={visibleLinks.length}
				filterRelation={filterRelation}
				onClearFilter={() => setFilterRelation("all")}
			/>

			{/* Legend */}
			<Legend
				showLegend={showLegend}
				onToggle={() => setShowLegend(!showLegend)}
				visibleRelationTypes={visibleRelationTypes}
			/>
		</div>
	);
}
