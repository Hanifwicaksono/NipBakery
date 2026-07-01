import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Edit2, Loader2, FolderPlus } from 'lucide-react'
import { IngredientCategoryRepository } from '@/repositories/ingredient-category.repository'
import type { IngredientCategory } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

const categoryRepo = new IngredientCategoryRepository()

const FormSchema = z.object({
  name: z.string().min(1, 'Category name is required'),
})

type FormData = z.infer<typeof FormSchema>;

export const CategoriesList: React.FC = () => {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<IngredientCategory | null>(null)

  const { data: categories = [], isLoading, error } = useQuery<IngredientCategory[]>({
    queryKey: ['categories'],
    queryFn: () => categoryRepo.list(),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
    },
  })

  // Mutate create
  const createMutation = useMutation({
    mutationFn: (newCat: IngredientCategory) => categoryRepo.create(newCat),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      closeDialog()
    },
  })

  // Mutate update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<IngredientCategory> }) => categoryRepo.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      closeDialog()
    },
  })

  // Mutate delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoryRepo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  const onSubmit = (data: FormData) => {
    if (editingCategory) {
      updateMutation.mutate({
        id: editingCategory.id,
        data: { name: data.name },
      })
    } else {
      const newCategory: IngredientCategory = {
        id: `cat_${Date.now()}`,
        name: data.name,
      }
      createMutation.mutate(newCategory)
    }
  }

  const openNewDialog = () => {
    setEditingCategory(null)
    reset({ name: '' })
    setIsOpen(true)
  }

  const openEditDialog = (category: IngredientCategory) => {
    setEditingCategory(category)
    reset({ name: category.name })
    setIsOpen(true)
  }

  const closeDialog = () => {
    setIsOpen(false)
    setEditingCategory(null)
    reset()
  }

  const handleDelete = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus kategori ini?')) {
      deleteMutation.mutate(id)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Card className="border-[#E5E7EB] bg-white rounded-xl shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E5E7EB] px-6 py-5 bg-gray-50/50">
        <div>
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-gray-600" />
            <span>Kategori Bahan Baku</span>
          </CardTitle>
          <CardDescription className="text-xs text-gray-500 mt-1">
            Kelola kategori untuk mempermudah klasifikasi bahan baku Anda.
          </CardDescription>
        </div>
        <Button onClick={openNewDialog} className="bg-[#111827] text-white hover:bg-gray-800 rounded-xl flex items-center gap-2 font-medium shrink-0">
          <Plus className="h-4 w-4" />
          <span>Kategori Baru</span>
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-12 flex justify-center items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Memuat kategori...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500 text-sm">
            Gagal memuat kategori. Silakan coba lagi.
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            Belum ada kategori. Klik "Kategori Baru" untuk menambahkan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50/30">
                <TableRow className="border-b border-[#E5E7EB]">
                  <TableHead className="w-[100px] text-xs font-semibold text-gray-500">No</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500">Nama Kategori</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-gray-500 w-[150px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category, idx) => (
                  <TableRow key={category.id} className="border-b border-[#E5E7EB] hover:bg-gray-50/50 transition-colors duration-150">
                    <TableCell className="font-medium text-gray-900">{idx + 1}</TableCell>
                    <TableCell className="font-semibold text-gray-900">{category.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(category)}
                          className="h-8 w-8 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(category.id)}
                          className="h-8 w-8 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog Form Kategori */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              {editingCategory ? 'Edit Kategori' : 'Kategori Baru'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-semibold text-gray-700">Nama Kategori</label>
              <Input
                id="name"
                type="text"
                placeholder="misal: Tepung, Cokelat, Diary"
                className="rounded-lg border-[#E5E7EB]"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>
              )}
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl border-[#E5E7EB]">
                Batal
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-[#111827] text-white hover:bg-gray-800 rounded-xl flex items-center gap-2">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{editingCategory ? 'Simpan Perubahan' : 'Tambah Kategori'}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
export default CategoriesList
