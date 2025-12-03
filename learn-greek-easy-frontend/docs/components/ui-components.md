# UI Components Reference

Shadcn/ui components used in the Learn Greek Easy application.

[← Back to Main Components Reference](../Components-Reference.md)

---

## Shadcn/ui Components

### Avatar

**Purpose**: Display user profile pictures or initials

**Installation**: `npx shadcn-ui@latest add avatar`

**Usage**:
```tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// With image
<Avatar>
  <AvatarImage src="/avatar.jpg" alt="User Name" />
  <AvatarFallback>UN</AvatarFallback>
</Avatar>

// Initials only
<Avatar>
  <AvatarFallback className="bg-gradient-to-br from-[#667eea] to-[#764ba2]">
    AS
  </AvatarFallback>
</Avatar>
```

**Props**:
- Inherits all `div` props
- `AvatarImage`: `src`, `alt`
- `AvatarFallback`: Displays when image fails or is loading

---

### Badge

**Purpose**: Status indicators and labels

**Installation**: `npx shadcn-ui@latest add badge`

**Variants**: `default`, `secondary`, `destructive`, `outline`

**Custom Variants for App**:
```tsx
import { Badge } from '@/components/ui/badge';
import { cva } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
  {
    variants: {
      status: {
        'in-progress': 'bg-[#dbeafe] text-[#1e40af]',
        completed: 'bg-[#d1fae5] text-[#065f46]',
        'not-started': 'bg-[#f3f4f6] text-[#6b7280]',
      },
    },
  }
);

// Usage
<Badge className={badgeVariants({ status: 'in-progress' })}>
  In Progress
</Badge>
```

**Props**:
- `variant`: Badge style variant
- `className`: Additional classes

---

### Button

**Purpose**: All user action triggers

**Installation**: `npx shadcn-ui@latest add button`

**Variants**: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`

**Sizes**: `default`, `sm`, `lg`, `icon`

**Usage**:
```tsx
import { Button } from '@/components/ui/button';

// Primary button (use gradient via className)
<Button
  size="lg"
  className="bg-gradient-to-br from-[#667eea] to-[#764ba2] hover:shadow-lg"
>
  Start Review
</Button>

// Secondary button
<Button variant="secondary">
  View All Decks
</Button>

// Ghost button
<Button variant="ghost" size="sm">
  Cancel
</Button>

// Icon button
<Button variant="ghost" size="icon">
  <SearchIcon className="h-4 w-4" />
</Button>
```

**Props**:
- `variant`: Button style
- `size`: Button size
- `disabled`: Disabled state
- `onClick`: Click handler
- All standard `button` props

---

### Card

**Purpose**: Container for grouped content

**Installation**: `npx shadcn-ui@latest add card`

**Components**: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`

**Usage**:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

<Card className="hover:border-[#2563eb] transition-all">
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
</Card>
```

**Styling**:
- Default: White background, 1px border (#e5e7eb), 12px border radius
- Hover: Blue border, elevated shadow

---

### Dialog

**Purpose**: Modal dialogs for confirmations and forms

**Installation**: `npx shadcn-ui@latest add dialog`

**Components**: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`

**Usage**:
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

<Dialog>
  <DialogTrigger asChild>
    <Button>Start Review</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Ready to review?</DialogTitle>
    </DialogHeader>
    <p>You have 24 cards due for review.</p>
    <DialogFooter>
      <Button variant="secondary">Cancel</Button>
      <Button>Start</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### DropdownMenu

**Purpose**: Contextual menus and user menus

**Installation**: `npx shadcn-ui@latest add dropdown-menu`

**Components**: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`

**Usage**:
```tsx
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <Avatar>
        <AvatarFallback>AS</AvatarFallback>
      </Avatar>
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Settings</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Logout</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

### NavigationMenu

**Purpose**: Desktop navigation with dropdowns

**Installation**: `npx shadcn-ui@latest add navigation-menu`

**Components**: `NavigationMenu`, `NavigationMenuList`, `NavigationMenuItem`, `NavigationMenuLink`

**Usage**:
```tsx
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from '@/components/ui/navigation-menu';

<NavigationMenu>
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuLink href="/dashboard" active>
        Dashboard
      </NavigationMenuLink>
    </NavigationMenuItem>
    <NavigationMenuItem>
      <NavigationMenuLink href="/decks">
        All Decks
      </NavigationMenuLink>
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenu>
```

---

### Progress

**Purpose**: Visual progress indicator

**Installation**: `npx shadcn-ui@latest add progress`

**Usage**:
```tsx
import { Progress } from '@/components/ui/progress';

// Default blue progress
<Progress value={68} className="h-2" />

// Success green progress
<Progress value={100} className="h-2 [&>div]:bg-[#10b981]" />
```

**Props**:
- `value`: Progress value (0-100)
- `max`: Maximum value (default: 100)
- `className`: Additional styling

---

### ScrollArea

**Purpose**: Custom scrollbar for content areas

**Installation**: `npx shadcn-ui@latest add scroll-area`

**Usage**:
```tsx
import { ScrollArea } from '@/components/ui/scroll-area';

<ScrollArea className="h-[400px] w-full">
  <div className="space-y-4">
    {items.map(item => <DeckCard key={item.id} {...item} />)}
  </div>
</ScrollArea>
```

**Use Cases**:
- Deck lists with > 5 items
- Long statistics tables
- Mobile content areas

---

### Separator

**Purpose**: Visual dividers between content

**Installation**: `npx shadcn-ui@latest add separator`

**Usage**:
```tsx
import { Separator } from '@/components/ui/separator';

<div>
  <Section>Content 1</Section>
  <Separator className="my-6" />
  <Section>Content 2</Section>
</div>
```

**Props**:
- `orientation`: `horizontal` (default) or `vertical`
- `decorative`: `true` if purely visual (hides from screen readers)

---

### Sheet

**Purpose**: Slide-out panels and mobile menus

**Installation**: `npx shadcn-ui@latest add sheet`

**Components**: `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`

**Usage**:
```tsx
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon">
      <MenuIcon />
    </Button>
  </SheetTrigger>
  <SheetContent side="right">
    <nav className="space-y-4">
      <a href="/dashboard">Dashboard</a>
      <a href="/decks">All Decks</a>
      <a href="/statistics">Statistics</a>
      <a href="/settings">Settings</a>
    </nav>
  </SheetContent>
</Sheet>
```

**Props**:
- `side`: `top`, `right` (default), `bottom`, `left`

---

### Skeleton

**Purpose**: Loading placeholders

**Installation**: `npx shadcn-ui@latest add skeleton`

**Usage**:
```tsx
import { Skeleton } from '@/components/ui/skeleton';

// Loading metric card
<Card>
  <CardContent className="space-y-2 p-6">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-8 w-16" />
    <Skeleton className="h-3 w-32" />
  </CardContent>
</Card>

// Loading deck card
<Card>
  <CardContent className="space-y-4 p-6">
    <Skeleton className="h-5 w-3/4" />
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-2 w-full" />
  </CardContent>
</Card>
```

---

### Toast

**Purpose**: Temporary notification messages

**Installation**: `npx shadcn-ui@latest add toast`

**Setup**:
```tsx
// In your root layout
import { Toaster } from '@/components/ui/toaster';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

**Usage**:
```tsx
import { useToast } from '@/components/ui/use-toast';

function Component() {
  const { toast } = useToast();

  const handleSuccess = () => {
    toast({
      title: "Success!",
      description: "Deck completed successfully.",
    });
  };

  const handleError = () => {
    toast({
      title: "Error",
      description: "Failed to load decks.",
      variant: "destructive",
    });
  };
}
```

---

### Tooltip

**Purpose**: Contextual hints on hover

**Installation**: `npx shadcn-ui@latest add tooltip`

**Components**: `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`

**Usage**:
```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="metric-card">
        <span>Due Today</span>
        <span className="text-2xl font-bold">24</span>
      </div>
    </TooltipTrigger>
    <TooltipContent>
      <p>Cards scheduled for review today</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---
