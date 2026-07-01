import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Edit2, Loader2, Truck, Phone, Mail, MapPin, User } from 'lucide-react'
import { SupplierRepository } from '@/repositories/supplier.repository'
import type { Supplier } from '@/types'

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

const supplierRepo = new SupplierRepository()

const FormSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').or(z.literal('')).optional(),
  address: z.string().optional(),
})

type FormData = z.infer<typeof FormSchema>;

export const SuppliersList: React.FC = () => {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  const { data: suppliers = [], isLoading, error } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => supplierRepo.list(),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      contactName: '',
      phone: '',
      email: '',
      address: '',
    },
  })

  // Mutate create
  const createMutation = useMutation({
    mutationFn: (newSup: Supplier) => supplierRepo.create(newSup),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      closeDialog()
    },
  })

  // Mutate update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<Supplier> }) => supplierRepo.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      closeDialog()
    },
  })

  // Mutate delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) => supplierRepo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })

  const onSubmit = (data: FormData) => {
    const cleanData = {
      name: data.name,
      contactName: data.contactName || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      address: data.address || undefined,
    }

    if (editingSupplier) {
      updateMutation.mutate({
        id: editingSupplier.id,
        data: cleanData,
      })
    } else {
      const newSupplier: Supplier = {
        id: `sup_${Date.now()}`,
        ...cleanData,
      }
      createMutation.mutate(newSupplier)
    }
  }

  const openNewDialog = () => {
    setEditingSupplier(null)
    reset({
      name: '',
      contactName: '',
      phone: '',
      email: '',
      address: '',
    })
    setIsOpen(true)
  }

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    reset({
      name: supplier.name,
      contactName: supplier.contactName || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
    })
    setIsOpen(true)
  }

  const closeDialog = () => {
    setIsOpen(false)
    setEditingSupplier(null)
    reset()
  }

  const handleDelete = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus supplier ini?')) {
      deleteMutation.mutate(id)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Card className="border-[#E5E7EB] bg-white rounded-xl shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E5E7EB] px-6 py-5 bg-gray-50/50">
        <div>
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="h-5 w-5 text-gray-600" />
            <span>Daftar Supplier</span>
          </CardTitle>
          <CardDescription className="text-xs text-gray-500 mt-1">
            Kelola data distributor dan supplier untuk pasokan bahan baku Anda.
          </CardDescription>
        </div>
        <Button onClick={openNewDialog} className="bg-[#111827] text-white hover:bg-gray-800 rounded-xl flex items-center gap-2 font-medium shrink-0">
          <Plus className="h-4 w-4" />
          <span>Supplier Baru</span>
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-12 flex justify-center items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Memuat supplier...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500 text-sm">
            Gagal memuat supplier. Silakan coba lagi.
          </div>
        ) : suppliers.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            Belum ada supplier. Klik "Supplier Baru" untuk menambahkan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50/30">
                <TableRow className="border-b border-[#E5E7EB]">
                  <TableHead className="text-xs font-semibold text-gray-500">Nama Supplier</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500">Kontak</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500">Telepon / Email</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500">Alamat</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-gray-500 w-[150px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id} className="border-b border-[#E5E7EB] hover:bg-gray-50/50 transition-colors duration-150">
                    <TableCell className="font-semibold text-gray-900">{supplier.name}</TableCell>
                    <TableCell className="text-gray-600 text-sm">
                      {supplier.contactName ? (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-gray-400" />
                          {supplier.contactName}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm space-y-1">
                      {supplier.phone && (
                        <span className="flex items-center gap-1 text-xs">
                          <Phone className="h-3 w-3 text-gray-400" />
                          {supplier.phone}
                        </span>
                      )}
                      {supplier.email && (
                        <span className="flex items-center gap-1 text-xs">
                          <Mail className="h-3 w-3 text-gray-400" />
                          {supplier.email}
                        </span>
                      )}
                      {!supplier.phone && !supplier.email && (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm max-w-xs truncate">
                      {supplier.address ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{supplier.address}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(supplier)}
                          className="h-8 w-8 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(supplier.id)}
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

      {/* Dialog Form Supplier */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              {editingSupplier ? 'Edit Supplier' : 'Supplier Baru'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="sup-name" className="text-sm font-semibold text-gray-700">Nama Supplier *</label>
              <Input
                id="sup-name"
                type="text"
                placeholder="misal: PT. Sinar Bakerindo"
                className="rounded-lg border-[#E5E7EB]"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="contact" className="text-sm font-semibold text-gray-700">Nama Kontak (Sales)</label>
              <Input
                id="contact"
                type="text"
                placeholder="misal: Budi"
                className="rounded-lg border-[#E5E7EB]"
                {...register('contactName')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="phone" className="text-sm font-semibold text-gray-700">No Telepon</label>
                <Input
                  id="phone"
                  type="text"
                  placeholder="0812xxxxxx"
                  className="rounded-lg border-[#E5E7EB]"
                  {...register('phone')}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-semibold text-gray-700">Email</label>
                <Input
                  id="email"
                  type="text"
                  placeholder="sales@supplier.com"
                  className="rounded-lg border-[#E5E7EB]"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="address" className="text-sm font-semibold text-gray-700">Alamat</label>
              <Input
                id="address"
                type="text"
                placeholder="misal: Jl. Industri Raya No. 45"
                className="rounded-lg border-[#E5E7EB]"
                {...register('address')}
              />
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl border-[#E5E7EB]">
                Batal
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-[#111827] text-white hover:bg-gray-800 rounded-xl flex items-center gap-2">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{editingSupplier ? 'Simpan Perubahan' : 'Tambah Supplier'}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
export default SuppliersList
