import { useState, useCallback, useMemo, useEffect } from "react";
import {
	ChevronDown,
	Check,
	X,
	Sparkles,
	AlertTriangle,
	AlertCircle,
	Info,
	Lightbulb,
	RotateCw,
	History,
	ArrowRight,
	Clock,
	ChevronLeft,
	ChevronRight as ChevronRightIcon,
	Wand2,
	ThumbsUp,
} from "lucide-react";
import { useSettingsStore } from "@/store/settingsStore";
import { useUIStore } from "@/store/uiStore";
import { motion, AnimatePresence } from "framer-motion";
import type { EntityType } from "@/shared/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { DURATION, EASE, SPRING } from '@/components/shared/AnimationConfig'


// ============================================
// Types
// ============================================

type Severity = "error" | "warning" | "suggestion";
type IssueType =
	| "consistency"
	| "relationship"
	| "foreshadowing"
	| "suggestion"
	| "warning";

interface SuggestionItem {
	id: string;
	type: IssueType;
	severity: Severity;
	title: string;
	description: string;
	entityIds?: number[];
	entityType?: EntityType;
	autoFixable: boolean;
	lineReference?: string;
}

interface ReviewIteration {
	id: string;
	timestamp: string;
	category: EntityType;
	issueCount: number;
	severityCounts: Record<Severity, number>;
	suggestions: SuggestionItem[];
}

interface ReviewHistoryState {
	iterations: ReviewIteration[];
	currentIterationId: string | null;
}

// ============================================
// Enhanced Severity Configuration with Glow System
// ============================================

const SEVERITY_CONFIG: Record<
	Severity,
	{
		label: string;
		icon: typeof AlertTriangle;
		colors: {
			bg: string;
			text: string;
			border: string;
			badge: string;
			glow: string;
		};
		priority: number;
		gradient: string;
	}
> = {
	error: {
		label: "错误",
		icon: AlertCircle,
		colors: {
			bg: "rgba(196,92,92,0.12)",
			text: "var(--color-danger)",
			border: "rgba(196,92,92,0.25)",
			badge: "var(--color-vermillion)",
			glow: "rgba(196, 92, 92, 0.3)",
		},
		priority: 1,
		gradient:
			"linear-gradient(135deg, rgba(196,92,92,0.08) 0%, rgba(196,92,92,0.02) 100%)",
	},
	warning: {
		label: "警告",
		icon: AlertTriangle,
		colors: {
			bg: "rgba(232,184,125,0.12)",
			text: "var(--color-character)",
			border: "rgba(232,184,125,0.25)",
			badge: "var(--color-character)",
			glow: "rgba(232, 184, 125, 0.3)",
		},
		priority: 2,
		gradient:
			"linear-gradient(135deg, rgba(232,184,125,0.08) 0%, rgba(232,184,125,0.02) 100%)",
	},
	suggestion: {
		label: "建议",
		icon: Lightbulb,
		colors: {
			bg: "rgba(91,142,232,0.12)",
			text: "var(--color-outline)",
			border: "rgba(91,142,232,0.25)",
			badge: "var(--color-outline)",
			glow: "rgba(91, 142, 232, 0.3)",
		},
		priority: 3,
		gradient:
			"linear-gradient(135deg, rgba(91,142,232,0.08) 0%, rgba(91,142,232,0.02) 100%)",
	},
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
	consistency: "一致性",
	relationship: "关系",
	foreshadowing: "伏笔",
	suggestion: "建议",
	warning: "警告",
};

// ============================================
// Animation Variants
// ============================================

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.08, delayChildren: 0.06 },
	},
	exit: {
		opacity: 0,
		transition: { staggerChildren: 0.02, staggerDirection: -1 },
	},
};

const cardVariants = {
	hidden: { opacity: 0, y: 16, scale: 0.96, filter: 'blur(2px)' },
	visible: {
		opacity: 1,
		y: 0,
		scale: 1,
		filter: 'blur(0px)',
		transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
	},
	exit: {
		opacity: 0,
		y: -8,
		scale: 0.97,
		transition: { duration: 0.15 },
	},
};

const pulseGlowVariants = {
	idle: {
		boxShadow: "0 0 0px rgba(201, 169, 110, 0)",
	},
	active: {
		boxShadow: [
			"0 0 4px rgba(201, 169, 110, 0.2)",
			"0 0 14px rgba(201, 169, 110, 0.45)",
			"0 0 4px rgba(201, 169, 110, 0.2)",
		],
		transition: {
			duration: 2,
			repeat: Infinity,
			ease: "easeInOut" as const,
		},
	},
};

const shimmerVariants = {
	initial: { backgroundPosition: "-200% 0" },
	animate: {
		backgroundPosition: "200% 0",
		transition: { duration: 1.5, repeat: Infinity, ease: "linear" as const },
	},
};

// ============================================
// Helper: Map API severity to local severity
// ============================================

function mapSeverity(apiSeverity?: string, apiType?: string): Severity {
	if (apiSeverity === "high") return "error";
	if (apiSeverity === "medium") return "warning";
	if (apiType === "warning") return "warning";
	return "suggestion";
}

// ============================================
// Component: Enhanced Skeleton Card with Shimmer
// ============================================

function SkeletonCard() {
	return (
		<GlassCard
			intensity="light"
			border="subtle"
			padding="md"
			rounded="lg"
			className="space-y-2.5"
		>
			<div className="flex items-center gap-2">
				<div
					className="w-16 h-5 rounded-md animate-shimmer"
					style={{
						background:
							"linear-gradient(90deg, var(--color-surface-overlay) 25%, var(--border-subtle) 50%, var(--color-surface-overlay) 75%)",
						backgroundSize: "200% 100%",
					}}
				/>
				<div
					className="w-14 h-5 rounded-md animate-shimmer"
					style={{
						background:
							"linear-gradient(90deg, var(--color-surface-overlay) 25%, var(--border-subtle) 50%, var(--color-surface-overlay) 75%)",
						backgroundSize: "200% 100%",
					}}
				/>
			</div>
			<div
				className="w-3/4 h-4 rounded-md animate-shimmer"
				style={{
					background:
						"linear-gradient(90deg, var(--color-surface-overlay) 25%, var(--border-subtle) 50%, var(--color-surface-overlay) 75%)",
					backgroundSize: "200% 100%",
				}}
			/>
			<div
				className="w-full h-3 rounded-md animate-shimmer"
				style={{
					background:
						"linear-gradient(90deg, var(--color-surface-overlay) 25%, var(--border-subtle) 50%, var(--color-surface-overlay) 75%)",
					backgroundSize: "200% 100%",
				}}
			/>
		</GlassCard>
	);
}

// ============================================
// Component: Severity Filter Tabs
// ============================================

function SeverityFilterTabs({
	counts,
	activeFilter,
	onFilterChange,
}: {
	counts: Record<Severity | "all", number>;
	activeFilter: Severity | "all";
	onFilterChange: (filter: Severity | "all") => void;
}) {
	const tabs: Array<{ key: Severity | "all"; label: string; color: string }> = [
		{ key: "all", label: "全部", color: "var(--text-tertiary)" },
		{ key: "error", label: "错误", color: SEVERITY_CONFIG.error.colors.badge },
		{
			key: "warning",
			label: "警告",
			color: SEVERITY_CONFIG.warning.colors.badge,
		},
		{
			key: "suggestion",
			label: "建议",
			color: SEVERITY_CONFIG.suggestion.colors.badge,
		},
	];

	return (
		<div className="flex items-center gap-1 px-4 pt-2 pb-1">
			{tabs.map((tab) => {
				const isActive = activeFilter === tab.key;
				const count = counts[tab.key];
				return (
					<motion.button
						key={tab.key}
						onClick={() => onFilterChange(tab.key)}
						className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
						style={{
							backgroundColor: isActive ? `${tab.color}18` : "transparent",
							color: isActive ? tab.color : "var(--text-tertiary)",
						}}
						whileHover={{ scale: 1.02 }}
						whileTap={{ scale: 0.98 }}
						onMouseEnter={(e) => {
							if (!isActive)
								e.currentTarget.style.backgroundColor =
									"var(--color-surface-overlay)";
						}}
						onMouseLeave={(e) => {
							if (!isActive)
								e.currentTarget.style.backgroundColor = "transparent";
						}}
					>
						{tab.label}
						{count > 0 && (
							<motion.span
								className="text-[10px] px-1.5 py-0 rounded-full font-medium"
								style={{
									backgroundColor: isActive
										? `${tab.color}25`
										: "var(--color-surface-overlay)",
									color: isActive ? tab.color : "var(--text-disabled)",
								}}
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								transition={SPRING.BADGE}
							>
								{count}
							</motion.span>
						)}
					</motion.button>
				);
			})}
		</div>
	);
}

// ============================================
// Component: Review History Drawer
// ============================================

function ReviewHistoryDrawer({
	isOpen,
	onClose,
	history,
	currentIterationId,
	onSelectIteration,
}: {
	isOpen: boolean;
	onClose: () => void;
	history: ReviewIteration[];
	currentIterationId: string | null;
	onSelectIteration: (id: string) => void;
}) {
	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="absolute inset-0 z-30 bg-black/30"
						onClick={onClose}
					/>
					{/* Drawer */}
					<motion.div
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
						className="absolute right-0 top-0 bottom-0 z-40 w-[280px] flex flex-col bg-[var(--color-surface-base)] border-l border-[var(--border-subtle)]"
					>
						<div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
							<div className="flex items-center gap-2">
								<History className="w-4 h-4 text-[var(--text-tertiary)]" />
								<span className="text-sm font-medium text-[var(--text-primary)]">
									审查历史
								</span>
							</div>
							<button
								onClick={onClose}
								className="p-1 rounded hover:bg-white/10 transition-colors"
							>
								<X className="w-4 h-4 text-[var(--text-tertiary)]" />
							</button>
						</div>

						<div className="flex-1 overflow-y-auto p-3 space-y-2">
							{history.length === 0 ? (
								<div className="text-center py-8">
									<Clock className="w-8 h-8 mx-auto mb-2 text-[var(--text-disabled)]" />
									<p className="text-xs text-[var(--text-tertiary)]">
										暂无审查记录
									</p>
								</div>
							) : (
								history.map((iteration, index) => {
									const isActive = iteration.id === currentIterationId;
									const date = new Date(iteration.timestamp);
									const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

									return (
										<motion.button
											key={iteration.id}
											onClick={() => onSelectIteration(iteration.id)}
											className="w-full text-left rounded-xl p-3 transition-all"
											style={{
												backgroundColor: isActive
													? "var(--accent-muted)"
													: "var(--color-surface-raised)",
												border: `1px solid ${isActive ? "var(--accent-primary)25" : "var(--border-subtle)"}`,
											}}
											whileHover={{ scale: 1.01 }}
											whileTap={{ scale: 0.99 }}
										>
											<div className="flex items-center justify-between mb-1.5">
												<span
													className="text-xs font-medium"
													style={{
														color: isActive
															? "var(--accent-primary)"
															: "var(--text-primary)",
													}}
												>
													第 {history.length - index} 次审查
												</span>
												<span className="text-[10px] text-[var(--text-disabled)]">
													{timeStr}
												</span>
											</div>
											<div className="flex items-center gap-2">
												{iteration.severityCounts.error > 0 && (
													<span
														className="text-[10px] px-1.5 py-0.5 rounded"
														style={{
															backgroundColor: "var(--color-danger)15",
															color: "var(--color-danger)",
														}}
													>
														{iteration.severityCounts.error} 错误
													</span>
												)}
												{iteration.severityCounts.warning > 0 && (
													<span
														className="text-[10px] px-1.5 py-0.5 rounded"
														style={{
															backgroundColor: "var(--color-character)15",
															color: "var(--color-character)",
														}}
													>
														{iteration.severityCounts.warning} 警告
													</span>
												)}
												{iteration.severityCounts.suggestion > 0 && (
													<span
														className="text-[10px] px-1.5 py-0.5 rounded"
														style={{
															backgroundColor: "var(--color-outline)15",
															color: "var(--color-outline)",
														}}
													>
														{iteration.severityCounts.suggestion} 建议
													</span>
												)}
											</div>
										</motion.button>
									);
								})
							)}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}

// ============================================
// Component: Iteration Comparison View
// ============================================

function IterationComparisonView({
	iterations,
	onClose,
}: {
	iterations: ReviewIteration[];
	onClose: () => void;
}) {
	const [leftIndex, setLeftIndex] = useState(
		Math.max(0, iterations.length - 2),
	);
	const [rightIndex, setRightIndex] = useState(
		Math.max(0, iterations.length - 1),
	);

	const leftIter = iterations[leftIndex];
	const rightIter = iterations[rightIndex];

	if (!leftIter || !rightIter) return null;

	const leftIds = new Set(leftIter.suggestions.map((s) => s.id));
	const rightIds = new Set(rightIter.suggestions.map((s) => s.id));
	const resolvedIds = [...leftIds].filter((id) => !rightIds.has(id));
	const newIds = [...rightIds].filter((id) => !leftIds.has(id));

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: 20 }}
			className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl bg-[var(--color-surface-base)] border-t border-[var(--border-default)]"
			style={{
				maxHeight: "70%",
				boxShadow: "var(--shadow-float)",
			}}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
				<div className="flex items-center gap-2">
					<ArrowRight className="w-4 h-4 text-[var(--accent-primary)]" />
					<span className="text-sm font-medium text-[var(--text-primary)]">
						审查对比
					</span>
				</div>
				<button
					onClick={onClose}
					className="p-1 rounded hover:bg-white/10 transition-colors"
				>
					<X className="w-4 h-4 text-[var(--text-tertiary)]" />
				</button>
			</div>

			{/* Iteration selectors */}
			<div className="flex items-center gap-4 px-4 py-2 border-b border-white/[0.04]">
				<div className="flex-1">
					<span className="text-[10px] text-[var(--text-tertiary)]">
						较早版本
					</span>
					<div className="flex items-center gap-1 mt-0.5">
						<button
							onClick={() => setLeftIndex(Math.max(0, leftIndex - 1))}
							disabled={leftIndex === 0}
							className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 transition-opacity"
						>
							<ChevronLeft className="w-3 h-3 text-[var(--text-tertiary)]" />
						</button>
						<span className="text-xs font-medium text-[var(--text-primary)]">
							第 {leftIndex + 1} 次
						</span>
						<button
							onClick={() =>
								setLeftIndex(Math.min(rightIndex - 1, leftIndex + 1))
							}
							disabled={leftIndex >= rightIndex - 1}
							className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 transition-opacity"
						>
							<ChevronRightIcon className="w-3 h-3 text-[var(--text-tertiary)]" />
						</button>
					</div>
				</div>
				<ArrowRight className="w-4 h-4 flex-shrink-0 text-[var(--text-disabled)]" />
				<div className="flex-1">
					<span className="text-[10px] text-[var(--text-tertiary)]">
						较晚版本
					</span>
					<div className="flex items-center gap-1 mt-0.5">
						<button
							onClick={() =>
								setRightIndex(Math.max(leftIndex + 1, rightIndex - 1))
							}
							disabled={rightIndex <= leftIndex + 1}
							className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 transition-opacity"
						>
							<ChevronLeft className="w-3 h-3 text-[var(--text-tertiary)]" />
						</button>
						<span className="text-xs font-medium text-[var(--text-primary)]">
							第 {rightIndex + 1} 次
						</span>
						<button
							onClick={() =>
								setRightIndex(Math.min(iterations.length - 1, rightIndex + 1))
							}
							disabled={rightIndex >= iterations.length - 1}
							className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 transition-opacity"
						>
							<ChevronRightIcon className="w-3 h-3 text-[var(--text-tertiary)]" />
						</button>
					</div>
				</div>
			</div>

			{/* Comparison stats */}
			<div className="flex items-center gap-4 px-4 py-2 border-b border-white/[0.04]">
				<div className="flex items-center gap-1.5">
					<span className="text-[10px] text-[var(--text-tertiary)]">
						已解决:
					</span>
					<span className="text-xs font-medium text-[var(--color-success)]">
						{resolvedIds.length} 项
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					<span className="text-[10px] text-[var(--text-tertiary)]">新增:</span>
					<span className="text-xs font-medium text-[var(--color-character)]">
						{newIds.length} 项
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					<span className="text-[10px] text-[var(--text-tertiary)]">剩余:</span>
					<span className="text-xs font-medium text-[var(--text-primary)]">
						{rightIter.issueCount} 项
					</span>
				</div>
			</div>

			{/* Scrollable content */}
			<div
				className="overflow-y-auto p-3 space-y-2"
				style={{ maxHeight: "calc(70vh - 140px)" }}
			>
				{rightIter.suggestions.map((suggestion) => {
					const isNew = newIds.includes(suggestion.id);
					const config = SEVERITY_CONFIG[suggestion.severity];
					const Icon = config.icon;

					return (
						<div
							key={suggestion.id}
							className="p-2.5 rounded-xl"
							style={{
								backgroundColor: isNew
									? "var(--color-character)06"
									: "var(--color-surface-raised)",
								border: `1px solid ${isNew ? "var(--color-character)15" : "var(--border-subtle)"}`,
							}}
						>
							<div className="flex items-center gap-2 mb-1">
								{isNew && (
									<span
										className="text-[9px] px-1 py-0.5 rounded"
										style={{
											backgroundColor: "var(--color-character)15",
											color: "var(--color-character)",
										}}
									>
										新增
									</span>
								)}
								<Icon
									className="w-3 h-3"
									style={{ color: config.colors.badge }}
								/>
								<span className="text-xs font-medium text-[var(--text-primary)]">
									{suggestion.title}
								</span>
							</div>
							<p className="text-[11px] pl-5 text-[var(--text-tertiary)]">
								{suggestion.description}
							</p>
						</div>
					);
				})}

				{resolvedIds.length > 0 && (
					<div
						className="pt-2"
						style={{ borderTop: "1px solid var(--border-subtle)" }}
					>
						<p className="text-[10px] mb-2 text-[var(--text-disabled)]">
							已解决的问题
						</p>
						{resolvedIds.map((id) => {
							const suggestion = leftIter.suggestions.find((s) => s.id === id);
							if (!suggestion) return null;
							return (
								<div
									key={id}
									className="p-2.5 rounded-xl opacity-50"
									style={{
										backgroundColor: "var(--color-success)06",
										border: "1px solid var(--color-success)10",
									}}
								>
									<div className="flex items-center gap-2">
										<Check className="w-3 h-3 text-[var(--color-success)]" />
										<span className="text-xs line-through text-[var(--text-tertiary)]">
											{suggestion.title}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</motion.div>
	);
}

// ============================================
// Component: Enhanced Suggestion Card
// ============================================

function SuggestionCard({
	suggestion,
	isApplied,
	onDismiss,
	onApplyFix,
	onClickLocate,
}: {
	suggestion: SuggestionItem;
	isApplied: boolean;
	onDismiss: () => void;
	onApplyFix: () => void;
	onClickLocate: () => void;
}) {
	const config = SEVERITY_CONFIG[suggestion.severity];
	const Icon = config.icon;
	const [isExpanded, setIsExpanded] = useState(false);

	const accentBorderColor = config.colors.badge;

	return (
		<motion.div
			variants={cardVariants}
			layout
			className="rounded-xl group overflow-hidden relative"
			style={{
				background: isApplied
					? "linear-gradient(135deg, rgba(94,181,166,0.08) 0%, var(--color-surface-raised) 100%)"
					: config.gradient,
				border: `1px solid ${isApplied ? "rgba(94,181,166,0.2)" : "var(--border-subtle)"}`,
			}}
			whileHover={!isApplied ? {
				scale: 1.01,
				transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
			} : {}}
			onMouseEnter={(e) => {
				if (!isApplied) {
					e.currentTarget.style.background =
						"linear-gradient(135deg, rgba(201,169,110,0.06) 0%, var(--color-surface-overlay) 100%)";
					e.currentTarget.style.borderColor = `${config.colors.border}`;
					e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.25), 0 0 0 1px ${config.colors.glow}50, 0 0 24px ${config.colors.glow}30`;
				}
			}}
			onMouseLeave={(e) => {
				if (!isApplied) {
					e.currentTarget.style.background = config.gradient;
					e.currentTarget.style.borderColor = "var(--border-subtle)";
					e.currentTarget.style.boxShadow = "none";
				}
			}}
			exit={{ opacity: 0, x: -16, height: 0, marginBottom: 0, padding: 0 }}
			transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
		>
			{/* Gradient left border accent with glow */}
			<div
				className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full"
				style={{
					background: isApplied
						? "var(--color-success)"
						: `linear-gradient(180deg, ${accentBorderColor}90, ${accentBorderColor}, ${accentBorderColor}90)`,
					boxShadow: isApplied
						? "0 0 10px var(--color-success)50"
						: `0 0 10px ${accentBorderColor}50`,
				}}
			/>

			<div className="p-3.5 pl-4.5">
				<div className="flex items-start justify-between">
					<div className="flex-1 min-w-0">
						{/* Severity + Type badges */}
						<div className="flex items-center gap-1.5 mb-2 flex-wrap">
							<span
								className="text-[10px] px-2 py-0.5 rounded-md font-medium flex items-center gap-1"
								style={{
									backgroundColor: config.colors.bg,
									color: config.colors.text,
									boxShadow: `0 0 8px ${config.colors.glow}20`,
								}}
							>
								<Icon className="w-2.5 h-2.5" />
								{config.label}
							</span>
							{ISSUE_TYPE_LABELS[suggestion.type] && (
								<span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--color-surface-overlay)] text-[var(--text-tertiary)]">
									{ISSUE_TYPE_LABELS[suggestion.type]}
								</span>
							)}
							{suggestion.lineReference && (
								<button
									onClick={onClickLocate}
									className="text-[10px] px-2 py-0.5 rounded-md hover:bg-white/10 transition-colors flex items-center gap-1 bg-[var(--accent-muted)] text-[var(--accent-primary)]"
									title="定位到相关实体"
								>
									<Info className="w-2.5 h-2.5" />
									定位
								</button>
							)}
						</div>

						{/* Title */}
						<p className="text-sm font-medium mb-1.5 text-[var(--text-primary)]">
							{suggestion.title}
						</p>

						{/* Description - expandable */}
						<motion.div
							initial={false}
							animate={{ height: isExpanded ? "auto" : "3.2em" }}
							transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
							className="overflow-hidden"
						>
							<p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
								{suggestion.description}
							</p>
						</motion.div>

						{/* Expand/collapse hint */}
						{suggestion.description.length > 80 && (
							<button
								onClick={() => setIsExpanded(!isExpanded)}
								className="text-[10px] mt-1.5 text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors flex items-center gap-0.5"
							>
								<motion.span
									animate={{ rotate: isExpanded ? 180 : 0 }}
									transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
								>
									<ChevronDown className="w-3 h-3" />
								</motion.span>
								{isExpanded ? "收起" : "展开"}
							</button>
						)}
					</div>

					{/* Action buttons - refined styling */}
					<div className="flex gap-0.5 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
						{suggestion.autoFixable && (
							<motion.button
								onClick={onApplyFix}
								className="p-1.5 rounded-lg transition-all relative overflow-hidden"
								style={{
									color: isApplied
										? "var(--color-success)"
										: "var(--text-tertiary)",
									backgroundColor: isApplied
										? "rgba(94,181,166,0.15)"
										: "transparent",
								}}
								onMouseEnter={(e) => {
									if (!isApplied) {
										e.currentTarget.style.backgroundColor =
											"rgba(94,181,166,0.15)";
										e.currentTarget.style.color = "var(--color-success)";
										e.currentTarget.style.boxShadow =
											"0 0 10px rgba(94,181,166,0.35)";
									}
								}}
								onMouseLeave={(e) => {
									if (!isApplied) {
										e.currentTarget.style.backgroundColor = "transparent";
										e.currentTarget.style.color = "var(--text-tertiary)";
										e.currentTarget.style.boxShadow = "none";
									}
								}}
								title="自动修复"
								whileTap={{ scale: 0.85 }}
								disabled={isApplied}
							>
								<Wand2 className="w-3.5 h-3.5" />
							</motion.button>
						)}
						<motion.button
							onClick={onDismiss}
							className="p-1.5 rounded-lg transition-all text-[var(--text-tertiary)]"
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor =
									"var(--color-surface-overlay)";
								e.currentTarget.style.color = "var(--text-secondary)";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = "transparent";
								e.currentTarget.style.color = "var(--text-tertiary)";
							}}
							title="忽略"
							whileTap={{ scale: 0.85 }}
						>
							<X className="w-3.5 h-3.5" />
						</motion.button>
					</div>
				</div>
			</div>
		</motion.div>
	);
}

// ============================================
// Main Component: AISuggestionPanel
// ============================================

export function AISuggestionPanel() {
	const [isExpanded, setIsExpanded] = useState(true);
	const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
	const [dismissed, setDismissed] = useState<Set<string>>(new Set());
	const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
	const [isReviewing, setIsReviewing] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const [showComparison, setShowComparison] = useState(false);

	const [reviewHistory, setReviewHistory] = useState<ReviewHistoryState>({
		iterations: [],
		currentIterationId: null,
	});

	const aiReviewResult = useSettingsStore((state) => state.aiReviewResult);
	const reviewWithAI = useSettingsStore((state) => state.reviewWithAI);
	const settingsCategory = useUIStore((state) => state.settingsCategory);

	const currentSuggestions: SuggestionItem[] = useMemo(() => {
		if (!aiReviewResult) return [];

		const raw = aiReviewResult.raw_response as
			| {
					issues?: Array<{
						type: string;
						severity: string;
						title: string;
						description: string;
						entityIds?: number[];
					}>;
					suggestions?: Array<{
						title: string;
						description: string;
						type: string;
					}>;
					category?: string;
			  }
			| undefined;

		const issues: SuggestionItem[] = (raw?.issues || []).map(
			(issue, index) => ({
				id: `issue_${index}`,
				type:
					issue.type === "inconsistency"
						? "consistency"
						: (issue.type as IssueType),
				severity: mapSeverity(issue.severity, issue.type),
				title: issue.title,
				description: issue.description,
				entityIds: issue.entityIds,
				entityType: (raw?.category as EntityType) || "character",
				autoFixable: false,
				lineReference: issue.entityIds?.length
					? `实体 #${issue.entityIds[0]}`
					: undefined,
			}),
		);

		const suggestions: SuggestionItem[] = (raw?.suggestions || []).map(
			(s, index) => ({
				id: `suggestion_${index}`,
				type: "suggestion",
				severity: "suggestion",
				title: s.title,
				description: s.description,
				autoFixable: s.type === "optimization",
			}),
		);

		return [...issues, ...suggestions];
	}, [aiReviewResult]);

	useEffect(() => {
		if (currentSuggestions.length > 0 && aiReviewResult) {
			const iterationId = `iter_${Date.now()}`;
			const severityCounts = {
				error: currentSuggestions.filter((s) => s.severity === "error").length,
				warning: currentSuggestions.filter((s) => s.severity === "warning")
					.length,
				suggestion: currentSuggestions.filter(
					(s) => s.severity === "suggestion",
				).length,
			};

			const lastIter =
				reviewHistory.iterations[reviewHistory.iterations.length - 1];
			const isNewResult =
				!lastIter ||
				lastIter.issueCount !== currentSuggestions.length ||
				JSON.stringify(lastIter.suggestions.map((s) => s.title)) !==
					JSON.stringify(currentSuggestions.map((s) => s.title));

			if (isNewResult) {
				const raw = aiReviewResult.raw_response as
					| { category?: string }
					| undefined;
				const newIteration: ReviewIteration = {
					id: iterationId,
					timestamp: new Date().toISOString(),
					category: (raw?.category as EntityType) || "character",
					issueCount: currentSuggestions.length,
					severityCounts,
					suggestions: [...currentSuggestions],
				};
				setReviewHistory((prev) => ({
					iterations: [...prev.iterations, newIteration],
					currentIterationId: iterationId,
				}));
			}
		}
	}, [aiReviewResult?.raw_response, currentSuggestions.length]);

	const filteredSuggestions = useMemo(() => {
		let filtered = currentSuggestions.filter((s) => !dismissed.has(s.id));
		if (severityFilter !== "all") {
			filtered = filtered.filter((s) => s.severity === severityFilter);
		}
		return filtered.sort(
			(a, b) =>
				SEVERITY_CONFIG[a.severity].priority -
				SEVERITY_CONFIG[b.severity].priority,
		);
	}, [currentSuggestions, dismissed, severityFilter]);

	const severityCounts = useMemo(
		() => ({
			all: currentSuggestions.filter((s) => !dismissed.has(s.id)).length,
			error: currentSuggestions.filter(
				(s) => s.severity === "error" && !dismissed.has(s.id),
			).length,
			warning: currentSuggestions.filter(
				(s) => s.severity === "warning" && !dismissed.has(s.id),
			).length,
			suggestion: currentSuggestions.filter(
				(s) => s.severity === "suggestion" && !dismissed.has(s.id),
			).length,
		}),
		[currentSuggestions, dismissed],
	);

	const handleDismiss = useCallback((id: string) => {
		setDismissed((prev) => new Set([...prev, id]));
	}, []);

	const handleApplyFix = useCallback((id: string) => {
		setAppliedIds((prev) => new Set([...prev, id]));
		setTimeout(() => {
			setDismissed((prev) => new Set([...prev, id]));
			setAppliedIds((prev) => {
				const next = new Set(prev);
				next.delete(id);
				return next;
			});
		}, 800);
	}, []);

	const handleReReview = useCallback(async () => {
		setIsReviewing(true);
		try {
			// Use the current settings category, fallback to 'character' if not reviewable
			const reviewableCategories: EntityType[] = ['world', 'character', 'item', 'location', 'faction', 'rule'];
			const categoryToReview = reviewableCategories.includes(settingsCategory as EntityType)
				? (settingsCategory as EntityType)
				: 'character';
			await reviewWithAI(categoryToReview);
		} catch {
			// Error handled by store
		} finally {
			setIsReviewing(false);
		}
	}, [reviewWithAI, settingsCategory]);

	const handleLocate = useCallback((entityIds?: number[]) => {
		if (entityIds && entityIds.length > 0) {
			window.dispatchEvent(
				new CustomEvent("ai-review-locate", {
					detail: { entityIds },
				}),
			);
		}
	}, []);

	const handleSelectIteration = useCallback((id: string) => {
		setReviewHistory((prev) => ({ ...prev, currentIterationId: id }));
	}, []);

	const displaySuggestions = useMemo(() => {
		const currentIter = reviewHistory.iterations.find(
			(i) => i.id === reviewHistory.currentIterationId,
		);
		if (currentIter) {
			return currentIter.suggestions.filter((s) => !dismissed.has(s.id));
		}
		return filteredSuggestions;
	}, [reviewHistory, dismissed, filteredSuggestions]);

	const hasMultipleIterations = reviewHistory.iterations.length >= 2;

	return (
		<div className="relative bg-[var(--color-surface-base)]">
			{/* Decorative gradient accent */}
			<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-100)] to-transparent opacity-30" />
			{/* Subtle AI branding glow */}
			<div
				className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-8 opacity-[0.04] pointer-events-none"
				style={{
					background:
						"radial-gradient(ellipse at center, var(--accent-100), transparent 70%)",
				}}
			/>

			{/* Header with gradient background */}
			<motion.button
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full px-4 py-3 flex items-center justify-between transition-all hover:bg-[var(--color-surface-raised)] relative overflow-hidden"
				style={{
					borderBottom: isExpanded ? "1px solid var(--border-subtle)" : "none",
					background: isReviewing
						? "linear-gradient(135deg, rgba(201,169,110,0.08) 0%, var(--color-surface-base) 60%)"
						: "transparent",
				}}
				animate={isReviewing ? "active" : "idle"}
				variants={pulseGlowVariants}
			>
				{/* Animated gradient background when reviewing */}
				{isReviewing && (
					<motion.div
						className="absolute inset-0 pointer-events-none"
						style={{
							background: "linear-gradient(90deg, transparent, var(--accent-glow), transparent)",
							backgroundSize: "200% 100%",
						}}
						animate={{
							backgroundPosition: ["200% 0", "-200% 0"],
						}}
						transition={{
							duration: 2,
							repeat: Infinity,
							ease: "linear",
						}}
					/>
				)}
				<div className="flex items-center gap-2.5 relative z-10">
					{/* AI Icon with rotating animation when reviewing */}
					<div className="relative">
						<motion.div
							animate={isReviewing ? { rotate: [0, 15, -15, 0] } : { rotate: 0 }}
							transition={isReviewing ? {
								duration: 1.5,
								repeat: Infinity,
								ease: "easeInOut",
							} : {}}
						>
							<Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
						</motion.div>
						{isReviewing && (
							<motion.div
								className="absolute inset-0 rounded-full"
								style={{ border: "1px solid var(--accent-primary)" }}
								animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
								transition={{
									duration: 1.5,
									repeat: Infinity,
									ease: "easeOut",
								}}
							/>
						)}
					</div>
					<div className="flex flex-col items-start">
						<span className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
							AI 审查建议
						</span>
						{isReviewing && (
							<span className="text-[10px] text-[var(--accent-primary)] animate-pulse">
								正在分析设定...
							</span>
						)}
					</div>
					{severityCounts.all > 0 && !isReviewing && (
						<div className="flex items-center gap-1">
							{severityCounts.error > 0 && (
								<motion.span
									className="text-[10px] px-1.5 py-0.5 rounded font-medium"
									style={{
										backgroundColor: "var(--color-danger)15",
										color: "var(--color-danger)",
									}}
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									transition={SPRING.BADGE}
								>
									{severityCounts.error}
								</motion.span>
							)}
							{severityCounts.warning > 0 && (
								<motion.span
									className="text-[10px] px-1.5 py-0.5 rounded font-medium"
									style={{
										backgroundColor: "var(--color-character)15",
										color: "var(--color-character)",
									}}
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									transition={{ ...SPRING.BADGE, delay: 0.05 }}
								>
									{severityCounts.warning}
								</motion.span>
							)}
							{severityCounts.suggestion > 0 && (
								<motion.span
									className="text-[10px] px-1.5 py-0.5 rounded font-medium"
									style={{
										backgroundColor: "var(--color-outline)15",
										color: "var(--color-outline)",
									}}
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									transition={{ ...SPRING.BADGE, delay: 0.05 }}
								>
									{severityCounts.suggestion}
								</motion.span>
							)}
						</div>
					)}
				</div>
				<div className="flex items-center gap-1">
					{/* History button */}
					{reviewHistory.iterations.length > 0 && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								setShowHistory(true);
							}}
							className="p-1.5 rounded hover:bg-white/10 transition-colors"
							title="审查历史"
						>
							<History className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
						</button>
					)}
					{/* Comparison button */}
					{hasMultipleIterations && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								setShowComparison(true);
							}}
							className="p-1.5 rounded hover:bg-white/10 transition-colors"
							title="审查对比"
						>
							<ArrowRight className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
						</button>
					)}
					<motion.div
						animate={{ rotate: isExpanded ? 0 : 180 }}
						transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
					>
						<ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
					</motion.div>
				</div>
			</motion.button>

			{/* Content */}
			<AnimatePresence mode="wait">
				{isExpanded && (
					<motion.div
						className="overflow-hidden"
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
					>
						{/* Severity filter tabs */}
						{currentSuggestions.length > 0 && (
							<SeverityFilterTabs
								counts={severityCounts}
								activeFilter={severityFilter}
								onFilterChange={setSeverityFilter}
							/>
						)}

						<div className="px-4 pb-4 pt-2 space-y-2.5 max-h-[400px] overflow-y-auto">
							{/* Loading skeleton state */}
							<AnimatePresence>
								{isReviewing && displaySuggestions.length === 0 && (
									<motion.div
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										className="space-y-2"
									>
										<SkeletonCard />
										<SkeletonCard />
										<SkeletonCard />
									</motion.div>
								)}
							</AnimatePresence>

							{!isReviewing && displaySuggestions.length === 0 ? (
								<motion.div
									className="text-center py-8"
									initial={{ opacity: 0, scale: 0.9 }}
									animate={{ opacity: 1, scale: 1 }}
									transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
								>
									<motion.div
										className="relative inline-block"
										initial={{ scale: 0 }}
										animate={{ scale: 1 }}
										transition={{ ...SPRING.SNAPPY, delay: 0.1 }}
									>
										<div className="absolute inset-0 rounded-full bg-[var(--color-success)] opacity-10 blur-xl" />
										<ThumbsUp className="w-8 h-8 mx-auto mb-3 text-[var(--color-success)] relative z-10" />
									</motion.div>
									<p className="text-sm font-medium text-[var(--text-secondary)]">
										{severityFilter !== "all"
											? `暂无${SEVERITY_CONFIG[severityFilter].label}级别的问题`
											: "设定一致，暂无建议"}
									</p>
									<p className="text-xs text-[var(--text-tertiary)] mt-1">
										AI 已完成审查，未发现明显问题
									</p>
									{severityFilter !== "all" && (
										<button
											onClick={() => setSeverityFilter("all")}
											className="text-xs mt-2 hover:underline text-[var(--accent-primary)] transition-colors"
										>
											查看全部
										</button>
									)}
								</motion.div>
							) : (
								<motion.div
									variants={containerVariants}
									initial="hidden"
									animate="visible"
									exit="exit"
								>
									<AnimatePresence>
										{displaySuggestions.map((suggestion) => (
											<SuggestionCard
												key={suggestion.id}
												suggestion={suggestion}
												isApplied={appliedIds.has(suggestion.id)}
												onDismiss={() => handleDismiss(suggestion.id)}
												onApplyFix={() => handleApplyFix(suggestion.id)}
												onClickLocate={() => handleLocate(suggestion.entityIds)}
											/>
										))}
									</AnimatePresence>
								</motion.div>
							)}

							{/* Batch actions */}
							<AnimatePresence>
								{displaySuggestions.length > 0 && (
									<motion.div
										className="flex gap-2 pt-2"
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: 8 }}
										transition={{
											delay: Math.min(
												displaySuggestions.length * 0.05 + 0.05,
												0.3,
											),
										}}
									>
										<motion.button
											onClick={() => {
												displaySuggestions
													.filter((s) => s.autoFixable)
													.forEach((s) => handleApplyFix(s.id));
											}}
											className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all relative overflow-hidden"
											style={{
												background:
													"linear-gradient(135deg, rgba(94,181,166,0.12) 0%, rgba(94,181,166,0.06) 100%)",
												color: "var(--color-success)",
												border: "1px solid rgba(94,181,166,0.25)",
											}}
											whileHover={{
												scale: 1.01,
												boxShadow: "0 0 14px rgba(94,181,166,0.3)",
											}}
											whileTap={{ scale: 0.98 }}
										>
											<Wand2 className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
											应用所有修复
										</motion.button>
										<motion.button
											onClick={() =>
												setDismissed(
													new Set(displaySuggestions.map((s) => s.id)),
												)
											}
											className="flex-1 py-2 rounded-xl text-xs font-medium transition-all bg-transparent text-[var(--text-tertiary)] border border-[var(--border-default)] hover:bg-white/5 hover:text-[var(--text-secondary)]"
											whileHover={{ scale: 1.01 }}
											whileTap={{ scale: 0.98 }}
										>
											全部忽略
										</motion.button>
									</motion.div>
								)}
							</AnimatePresence>

							{/* Re-review button */}
							<div className="pt-3">
								<motion.button
									onClick={handleReReview}
									disabled={isReviewing}
									className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 relative overflow-hidden"
									style={{
										background: isReviewing
											? "linear-gradient(135deg, rgba(201,169,110,0.15) 0%, rgba(201,169,110,0.08) 100%)"
											: "linear-gradient(135deg, rgba(201,169,110,0.12) 0%, rgba(201,169,110,0.06) 100%)",
										color: "var(--accent-primary)",
										border: "1px solid rgba(201,169,110,0.25)",
									}}
									whileHover={
										!isReviewing
											? {
													scale: 1.01,
													boxShadow:
														"0 0 18px rgba(201,169,110,0.3), 0 0 36px rgba(201,169,110,0.15)",
												}
											: {}
									}
									whileTap={!isReviewing ? { scale: 0.98 } : {}}
								>
									{/* Shimmer effect when reviewing */}
									{isReviewing && (
										<motion.div
											className="absolute inset-0"
											style={{
												background:
													"linear-gradient(90deg, transparent 0%, rgba(201,169,110,0.1) 50%, transparent 100%)",
												backgroundSize: "200% 100%",
											}}
											variants={shimmerVariants}
											initial="initial"
											animate="animate"
										/>
									)}
									<motion.div
										className="relative z-10"
										animate={isReviewing ? { rotate: 360 } : { rotate: 0 }}
										transition={
											isReviewing
												? { duration: 1, repeat: Infinity, ease: "linear" }
												: {}
										}
									>
										<RotateCw className="w-3.5 h-3.5" />
									</motion.div>
									<span className="relative z-10">
										{isReviewing ? "审查中..." : "重新审查"}
									</span>
								</motion.button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* History drawer */}
			<ReviewHistoryDrawer
				isOpen={showHistory}
				onClose={() => setShowHistory(false)}
				history={reviewHistory.iterations}
				currentIterationId={reviewHistory.currentIterationId}
				onSelectIteration={(id) => {
					handleSelectIteration(id);
					setShowHistory(false);
				}}
			/>

			{/* Comparison view */}
			<AnimatePresence>
				{showComparison && hasMultipleIterations && (
					<IterationComparisonView
						iterations={reviewHistory.iterations}
						onClose={() => setShowComparison(false)}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}
